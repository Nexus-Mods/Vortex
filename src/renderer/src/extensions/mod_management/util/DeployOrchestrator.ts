import { FileSourceKind, resolve, type Lockfile } from "@nexusmods/mod-pipeline";
import {
  getErrorMessageOrDefault,
  parseError,
  VortexGameId,
  VortexProfileId,
} from "@vortex/shared";

import { log } from "../../../logging";
import type { IRegisteredExtension } from "../../../types/extensions";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { fileMD5 } from "../../../util/checksum";
import {
  emitPlannerPlanEvent,
  type PlannerPlanFigures,
} from "../../analytics/utils/plannerPlanEvent";
import { gameIdOfProfile, lastActiveProfileForGame } from "../../profile_management/selectors";
import { ApplyStatus, type ApplyResult } from "./apply/apply";
import { deploymentFailures } from "./deploymentFailures";
import {
  applyPlan,
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
import {
  LockfileContributions,
  type LockfileContribution,
  type LockfileContributionCondition,
} from "./lockfileContributions";
import { gatherResolverInput } from "./resolverInput";
import { compareWithManifests } from "./shadowComparison";

/** The games whose deployments are planned. */
const RESOLVED_GAMES: ReadonlySet<VortexGameId> = new Set([VortexGameId("skyrimse")]);

// extensions register at init, before an orchestrator exists
const registeredContributions = new LockfileContributions();

/** The name a contribution is reported under: its extension's name, else its path. */
export function contributorOf(
  extensionPath?: string,
  extInfo?: Partial<IRegisteredExtension>,
): string {
  return extInfo?.name ?? extensionPath ?? "unknown";
}

/** Registers a contribution; the extension manager appends the caller's path and info. */
export function registerLockfileContribution(
  condition: LockfileContributionCondition,
  generate: LockfileContribution,
  extensionPath?: string,
  extInfo?: Partial<IRegisteredExtension>,
): void {
  registeredContributions.register(contributorOf(extensionPath, extInfo), condition, generate);
}

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

/** A planned deployment that hasn't finished: the lockfile it deploys, and its plan run's figures. */
interface PendingDeployment {
  gameMode: VortexGameId;
  current: StagedLockfile;
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
    contributions: LockfileContributions = registeredContributions,
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

      const { current, resolveMs, diskScan, scanMs } = await resolveAndScan(
        this.#api,
        gameMode,
        profileId,
        previous.lockfile,
        hashOnce,
      );
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
      this.#pending = { gameMode, current, figures };
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
   * Runs the pending deployment's plan through Apply and reports its plan run. An applied run's
   * lockfile becomes the game's last deployed one; a refused or rolled back run left the disk as
   * the previous one describes, so that one stays. Undefined when `plan` isn't the pending one.
   */
  public async apply(plan: DeploymentPlan, run: ApplyRun): Promise<ApplyResult | undefined> {
    const pending = this.#pending;
    if (pending === undefined || pending.current.lockfile !== plan.lockfile) {
      return undefined;
    }
    this.#pending = undefined;
    const { gameMode, current, figures } = pending;
    const result = await applyPlan(plan, run);
    switch (result.status) {
      case ApplyStatus.Applied:
        this.#previousLockfiles.set(gameMode, current);
        break;
      case ApplyStatus.Refused:
      case ApplyStatus.RolledBack:
        this.#previousLockfiles.set(gameMode, plan.previous);
        break;
      case ApplyStatus.Unfinished:
      case ApplyStatus.RollbackFailed:
        // the journal says where the disk is; the next plan reseeds
        break;
      default: {
        const exhausted: never = result;
        return exhausted;
      }
    }
    void emitPlannerPlanEvent(this.#api, gameMode, () => ({ ...figures, manifest_diff: null }));
    return result;
  }

  // TODO(MOD-134): remove once Apply replaces today's deploy
  /**
   * Keeps the lockfile of a pending deployment today's deploy finished as the game's last deployed
   * one, and reports its plan run with how the lockfile compares to the manifests.
   */
  public async deployed(profileId: VortexProfileId): Promise<void> {
    const gameMode = gameIdOfProfile(this.#api.getState(), profileId);
    const pending = this.#pending;
    if (pending === undefined || pending.gameMode !== gameMode) {
      return;
    }
    const { current, figures } = pending;
    this.#pending = undefined;
    // the lockfile is only what's deployed when every file was placed
    if (deploymentFailures(this.#api, gameMode).length === 0) {
      this.#previousLockfiles.set(gameMode, current);
    }
    const manifestDiff = await compareWithManifests(this.#api, gameMode, current.lockfile);
    void emitPlannerPlanEvent(this.#api, gameMode, () => ({
      ...figures,
      manifest_diff: manifestDiff,
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

/** An orchestrator that follows the api's deployment, purge and removal events. */
export function registerDeployOrchestrator(
  api: IExtensionApi,
  hashFile?: (filePath: string) => Promise<string>,
): DeployOrchestrator {
  const orchestrator = new DeployOrchestrator(api, hashFile);
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
