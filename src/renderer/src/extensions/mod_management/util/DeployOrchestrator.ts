import { FileSourceKind, resolve, type Lockfile } from "@nexusmods/mod-pipeline";
import {
  getErrorMessageOrDefault,
  parseError,
  VortexGameId,
  VortexProfileId,
} from "@vortex/shared";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { fileMD5 } from "../../../util/checksum";
import {
  emitPlannerPlanEvent,
  type PlannerPlanFigures,
} from "../../analytics/utils/plannerPlanEvent";
import { gameIdOfProfile, lastActiveProfileForGame } from "../../profile_management/selectors";
import { manifestFilesAfter, readManifestFiles, saveAppliedManifests } from "./appliedManifests";
import { ApplyStatus, type ApplyResult } from "./apply/apply";
import { deploymentFailures } from "./deploymentFailures";
import {
  applyPlan,
  clearedDestinationsOf,
  deployedOperationsOf,
  deploymentPlanOf,
  hashingOnce,
  planAndLogOperations,
  resolveAndScan,
  seededLockfile,
  type ApplyRun,
  type DeploymentPlan,
  type StagedLockfile,
} from "./deploymentPlan";
import { addGeneratedFiles } from "./generatedFiles";
import { keepLastPlan } from "./lastPlans";
import { type LockfileContributions } from "./lockfileContributions";
import { gatherResolverInput, type ManifestFiles } from "./resolverInput";
import { compareWithManifests } from "./shadowComparison";

/** The games whose deployments are planned. */
const RESOLVED_GAMES: ReadonlySet<VortexGameId> = new Set([VortexGameId("skyrimse")]);

/** Adds the files contributions declare for the state the lockfile was resolved from. */
async function withGeneratedFiles(
  state: IState,
  gameMode: VortexGameId,
  profileId: VortexProfileId,
  contributions: LockfileContributions,
  lockfile: Lockfile,
): Promise<Lockfile> {
  const generatedFiles = await contributions.generatedFiles(state, gameMode, profileId);
  return addGeneratedFiles(lockfile, generatedFiles);
}

/** A planned deployment that hasn't finished. */
interface PendingDeployment {
  gameMode: VortexGameId;
  /** the lockfile it deploys */
  current: StagedLockfile;
  /** its plan's */
  destinations: DeploymentPlan["destinations"];
  // TODO(MOD-134): remove with deployed()
  /** the game's manifests as they were when it was planned */
  manifestFilesBefore: ManifestFiles;
  figures: PlannerPlanFigures;
}

/**
 * Runs a deployment's steps in order (seed, resolve and scan, plan, apply, report) and holds what
 * they share. It only sequences: the steps do the work, and none of them reads what it holds.
 */
export class DeployOrchestrator {
  readonly #api: IExtensionApi;
  readonly #hashFile: (filePath: string) => Promise<string>;
  readonly #contributions: LockfileContributions;
  /** By game, the lockfile its last deployment deployed; seeded from the manifests while unknown */
  readonly #previousLockfiles = new Map<VortexGameId, StagedLockfile>();
  #pending: PendingDeployment | undefined;

  public constructor(
    api: IExtensionApi,
    hashFile: (filePath: string) => Promise<string> = fileMD5,
    contributions: LockfileContributions,
  ) {
    this.#api = api;
    this.#hashFile = hashFile;
    this.#contributions = contributions;
  }

  /** The game's lockfile: its enabled mods' files, then the files contributions declare. */
  public async resolveWithGeneratedFiles(gameMode: VortexGameId): Promise<Lockfile> {
    const state = this.#api.getState();
    const profileId = VortexProfileId(lastActiveProfileForGame(state, gameMode));
    const { input } = await gatherResolverInput(this.#api, profileId, this.#hashFile);
    return withGeneratedFiles(state, gameMode, profileId, this.#contributions, resolve(input));
  }

  /**
   * Plans the deployment of a resolved game's profile against the game's last deployed lockfile,
   * before the disk changes. Undefined for other games and on a failure, which is logged and reported.
   */
  public async plan(profileId: VortexProfileId): Promise<DeploymentPlan | undefined> {
    this.#pending = undefined;
    const gameMode = gameIdOfProfile(this.#api.getState(), profileId);
    if (gameMode === undefined || !RESOLVED_GAMES.has(gameMode)) {
      return undefined;
    }
    const figures: PlannerPlanFigures = {};
    // a seed and the resolve that follows it hash mostly the same staged files
    const hashOnce = hashingOnce(this.#hashFile);
    try {
      const previous =
        this.#previousLockfiles.get(gameMode) ??
        (await seededLockfile(this.#api, gameMode, hashOnce));
      // out until the deployment is confirmed: one that fails or never finishes may have changed
      // the disk, and the next plan then reseeds
      this.#previousLockfiles.delete(gameMode);

      const [{ current, resolveMs, diskScan, scanMs }, manifestFilesBefore] = await Promise.all([
        resolveAndScan(this.#api, gameMode, profileId, previous.lockfile, hashOnce),
        readManifestFiles(this.#api, gameMode),
      ]);
      const { lockfile } = current;
      figures.resolve_ms = resolveMs;
      figures.lockfile_files = lockfile.files.length;
      figures.generated_files = lockfile.files.filter(
        (file) => file.source === FileSourceKind.VortexGenerated,
      ).length;
      figures.scan_ms = scanMs;
      figures.disk_entries = diskScan.entries.length;
      figures.scan_roots = diskScan.roots.length;

      const { planMs, counts, destinations } = planAndLogOperations(
        gameMode,
        lockfile,
        previous.lockfile,
        diskScan,
        scanMs,
      );
      figures.plan_ms = planMs;
      figures.operations = counts;
      keepLastPlan(gameMode, { plannedAt: Temporal.Now.instant(), destinations });
      this.#pending = { gameMode, current, destinations, manifestFilesBefore, figures };
      return deploymentPlanOf(current, previous, destinations);
    } catch (err) {
      log("warn", "failed to plan deployment", { gameMode, error: getErrorMessageOrDefault(err) });
      void emitPlannerPlanEvent(this.#api, gameMode, () => ({
        ...figures,
        error_kind: parseError(err).data.kind,
      }));
      return undefined;
    }
  }

  /**
   * Runs the pending deployment's plan through Apply and reports its plan run. The run saves the
   * game's manifests from its operations, for `activatorId`, before it ends. A run whose
   * operations all ran leaves its lockfile as the game's last deployed one; a refused or rolled
   * back run keeps the previous one. Undefined when `plan` isn't pending.
   */
  public async apply(
    plan: DeploymentPlan,
    run: ApplyRun,
    activatorId: string,
  ): Promise<ApplyResult | undefined> {
    const pending = this.#pending;
    if (pending?.destinations !== plan.destinations) {
      return undefined;
    }
    this.#pending = undefined;
    const { gameMode, current, figures } = pending;
    const cleared = clearedDestinationsOf(plan.destinations);
    const result = await applyPlan(plan, {
      ...run,
      recordDeployment: (entries) =>
        saveAppliedManifests(this.#api, gameMode, run.fs, entries, cleared, activatorId),
    });
    switch (result.status) {
      case ApplyStatus.Applied:
      case ApplyStatus.Unfinished:
        this.#previousLockfiles.set(gameMode, current);
        break;
      case ApplyStatus.Refused:
      case ApplyStatus.RolledBack:
        this.#previousLockfiles.set(gameMode, plan.previous);
        break;
      case ApplyStatus.RollbackFailed:
        // the journal says where the disk is; the next plan reseeds
        break;
      default: {
        const exhausted: never = result;
        return exhausted;
      }
    }
    void emitPlannerPlanEvent(this.#api, gameMode, () => ({
      ...figures,
      manifest_diff: null,
      manifest_entry_diff: null,
    }));
    return result;
  }

  // TODO(MOD-134): remove once Apply replaces today's deploy
  /**
   * Keeps the lockfile of a pending deployment today's deploy finished as the game's last deployed
   * one, and reports its plan run with how the lockfile, and the manifests its plan's operations
   * would leave, compare to the manifests the deploy saved.
   */
  public async deployed(profileId: VortexProfileId): Promise<void> {
    const gameMode = gameIdOfProfile(this.#api.getState(), profileId);
    const pending = this.#pending;
    if (pending === undefined || pending.gameMode !== gameMode) {
      return;
    }
    const { current, destinations, manifestFilesBefore, figures } = pending;
    this.#pending = undefined;
    // the lockfile is only what's deployed when every file was placed
    if (deploymentFailures(this.#api, gameMode).length === 0) {
      this.#previousLockfiles.set(gameMode, current);
    }
    const { manifestDiff, manifestEntryDiff } = await compareWithManifests(
      this.#api,
      gameMode,
      current.lockfile,
      () =>
        manifestFilesAfter(
          this.#api,
          gameMode,
          window.api.fs,
          manifestFilesBefore,
          deployedOperationsOf(destinations, current.stagedFiles),
          clearedDestinationsOf(destinations),
        ),
    );
    void emitPlannerPlanEvent(this.#api, gameMode, () => ({
      ...figures,
      manifest_diff: manifestDiff,
      manifest_entry_diff: manifestEntryDiff,
    }));
  }

  /**
   * The game's disk changed outside a deployment: the next plan reseeds from the manifests, and a
   * pending deployment doesn't keep its lockfile.
   */
  public forget(gameMode: VortexGameId): void {
    this.#previousLockfiles.delete(gameMode);
    if (this.#pending?.gameMode === gameMode) {
      this.#pending = undefined;
    }
  }
}

/** Instantiates the the DeployOrchestrator and wires up all of the listeners caller */
/** called from mod_management/index.ts, curently called only in dev mode */
export function registerDeployOrchestrator(
  api: IExtensionApi,
  lockfileContributions: LockfileContributions,
  hashFile?: (filePath: string) => Promise<string>,
): DeployOrchestrator {
  const orchestrator = new DeployOrchestrator(api, hashFile, lockfileContributions);

  const forgetGame = (gameId: string) => {
    orchestrator.forget(VortexGameId(gameId));
    return Promise.resolve();
  };
  const forgetProfileGame = (profileId: string) => {
    const gameMode = gameIdOfProfile(api.getState(), VortexProfileId(profileId));
    if (gameMode !== undefined) {
      orchestrator.forget(gameMode);
    }
    return Promise.resolve();
  };
  api.onAsync<"did-deploy">("did-deploy", (profileId) =>
    orchestrator.deployed(VortexProfileId(profileId)),
  );
  // TODO(MOD-150): remove these two listeners once deploy-single-mod and mod removal run a full
  // Apply deploy
  api.onAsync<"will-remove-mods">("will-remove-mods", forgetGame);
  api.onAsync<"will-deploy-single-mod">("will-deploy-single-mod", forgetGame);
  // TODO(MOD-149): remove these two listeners once purge runs through Apply; a failed purge emits
  // only will-purge, a purge of one mod type only did-purge
  api.onAsync<"will-purge">("will-purge", forgetProfileGame);
  api.onAsync<"did-purge">("did-purge", forgetProfileGame);

  return orchestrator;
}
