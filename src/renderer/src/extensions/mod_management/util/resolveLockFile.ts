import {
  DiskEntryKind,
  FileSourceKind,
  inApplyOrder,
  OperationKind,
  pathKeyOf,
  planDestinations,
  resolve,
  sameOrigin,
  type DiskScan,
  type FileSource,
  type Lockfile,
  type PlannedDestination,
} from "@nexusmods/mod-pipeline";
import type { ManifestDiff, PlannerOperationCounts } from "@vortex/nexus-api-v3";
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
import { getGame } from "../../gamemode_management/util/getGame";
import { gameIdOfProfile, lastActiveProfileForGame } from "../../profile_management/selectors";
import { BACKUP_TAG } from "../LinkingDeployment";
import type { StagedFiles } from "./apply/apply";
import { deploymentFailures } from "./deploymentFailures";
import { scanDeploymentTargets } from "./diskScan";
import { addGeneratedFiles } from "./generatedFiles";
import { keepLastPlan } from "./lastPlans";
import {
  LockfileContributions,
  type LockfileContribution,
  type LockfileContributionCondition,
} from "./lockfileContributions";
import { countByOperation } from "./planTree";
import { gatherDeployedInput, gatherDeployedOrigins, gatherResolverInput } from "./resolverInput";
import { compareWithDeployment } from "./shadowComparison";

/** The games whose deployments are planned. */
const RESOLVED_GAMES: ReadonlySet<VortexGameId> = new Set([VortexGameId("skyrimse")]);

/** A lockfile, and where its files are staged. */
interface StagedLockfile {
  lockfile: Lockfile;
  stagedFiles: StagedFiles;
}

/** By game, the lockfile its last deployment deployed; seeded from the manifests while unknown */
const previousLockfiles = new Map<VortexGameId, StagedLockfile>();

/** The plan of the deployment in progress, until it finishes */
let pendingPlan:
  | { gameMode: VortexGameId; current: StagedLockfile; figures: PlannerPlanFigures }
  | undefined;

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

/** The game's lockfile: its enabled mods' files, then the files contributions declare. */
export async function resolveLockfile(
  api: IExtensionApi,
  gameMode: VortexGameId,
  contributions: LockfileContributions,
  hashFile: (filePath: string) => Promise<string>,
): Promise<Lockfile> {
  const state = api.getState();
  const profileId = VortexProfileId(lastActiveProfileForGame(state, gameMode));
  const { input } = await gatherResolverInput(api, profileId, hashFile);
  return withGeneratedFiles(state, gameMode, profileId, contributions, resolve(input));
}

const elapsedMsSince = (startedAt: Temporal.Instant) =>
  Temporal.Now.instant().since(startedAt).total("milliseconds");

function planAndLogOperations(
  gameMode: string,
  currentLockfile: Lockfile,
  previousLockfile: Lockfile,
  diskScan: DiskScan,
  scanMs: number,
): { planMs: number; counts: PlannerOperationCounts; destinations: PlannedDestination[] } {
  // expensive: a line per disk entry, hundreds of thousands on a large setup
  // diskScan.entries.forEach((d) => log("debug", "disk scan", d.path));

  // Now that we have both previous lockfile, current lockfile and the disk state do the actual planning
  const planStartedAt = Temporal.Now.instant();
  const destinations = planDestinations(currentLockfile, previousLockfile, diskScan, {
    backupPathOf: (destinationPath) => destinationPath + BACKUP_TAG,
  });
  const planMs = elapsedMsSince(planStartedAt);
  const countsByKind = countByOperation(destinations);
  const counts: PlannerOperationCounts = {
    backup: countsByKind[OperationKind.Backup],
    link: countsByKind[OperationKind.Link],
    unlink: countsByKind[OperationKind.Unlink],
  };

  log("info", "planner operations", {
    gameMode,
    roots: diskScan.roots.length,
    diskEntries: diskScan.entries.length,
    diskLinks: diskScan.entries.filter((entry) => entry.kind === DiskEntryKind.Link).length,
    backups: counts.backup,
    unlinks: counts.unlink,
    links: counts.link,
    scanMs,
    planMs,
  });

  // If we are doing the planing with the previous lockfile from one session the ops should reflect what needs
  // to be passes to the apply step to create a correct disk state of the game. If the prevoious lockfile is
  // created from the manifest then there should be no ops to do, and that is expected.
  inApplyOrder(destinations.flatMap((destination) => destination.operations)).forEach((o) =>
    log("debug", "planner operations ", {
      operation: o.kind,
      path: "file" in o ? o.file.destinationPath : o.destinationPath,
    }),
  );

  return { planMs, counts, destinations };
}

/** Compares the lockfile with the deployment's manifests and logs the result. */
async function compareWithManifests(
  api: IExtensionApi,
  gameMode: VortexGameId,
  lockfile: Lockfile,
): Promise<ManifestDiff | null> {
  try {
    const shadow = compareWithDeployment(lockfile, await gatherDeployedOrigins(api, gameMode));
    log("info", "shadow comparison", { gameMode, verdict: shadow.verdict, ...shadow.counts });
    return shadow;
  } catch (err) {
    log("warn", "failed to compare with the deployment", {
      gameMode,
      error: getErrorMessageOrDefault(err),
    });
    return null;
  }
}

/** A deployment's plan: its lockfile, every destination as planned, and where its files are staged. */
export interface DeploymentPlan {
  lockfile: Lockfile;
  destinations: PlannedDestination[];
  stagedFiles: StagedFiles;
}

/** `hashFile`, hashing each path once. */
function hashingOnce(
  hashFile: (filePath: string) => Promise<string>,
): (filePath: string) => Promise<string> {
  const hashes = new Map<string, Promise<string>>();
  return (filePath) => {
    let hash = hashes.get(filePath);
    if (hash === undefined) {
      hash = hashFile(filePath);
      hashes.set(filePath, hash);
    }
    return hash;
  };
}

/** What `run` returns, and how long it took. */
async function timed<T>(run: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const startedAt = Temporal.Now.instant();
  const result = await run();
  return { result, ms: elapsedMsSince(startedAt) };
}

/** The lockfile the deployment manifests list, without generated files. */
async function seededLockfile(
  api: IExtensionApi,
  gameMode: VortexGameId,
  hashFile: (filePath: string) => Promise<string>,
): Promise<StagedLockfile> {
  const startedAt = Temporal.Now.instant();
  const { input, notes, stagedFiles } = await gatherDeployedInput(api, gameMode, hashFile);
  const lockfile = resolve(input);
  log("info", "seeded previous lockfile from manifest", {
    gameMode,
    files: lockfile.files.length,
    notes: notes.length,
    firstNotes: notes.slice(0, 5),
    elapsedMs: elapsedMsSince(startedAt),
  });
  return { lockfile, stagedFiles };
}

// the planner's file identity (sameFile in the package's plan.ts): the same content from the same origin
const sameFile = (lhs: FileSource, rhs: FileSource) =>
  lhs.hashType === rhs.hashType && lhs.fileHash === rhs.fileHash && sameOrigin(lhs, rhs);

/**
 * Where a plan's files are staged: a LINK's file where the current lockfile says, an UNLINK's where
 * the previous one does. Indexed on first use, so a plan Apply never runs costs nothing.
 */
function stagedFilesOfPlan(current: StagedLockfile, previous: StagedLockfile): StagedFiles {
  let listings: { fileByKey: Map<string, FileSource>; stagedFiles: StagedFiles }[] | undefined;
  return {
    pathOf: (file) => {
      listings ??= [current, previous].map(({ lockfile, stagedFiles }) => ({
        fileByKey: new Map(
          lockfile.files.map((listed) => [pathKeyOf(listed.destinationPath), listed]),
        ),
        stagedFiles,
      }));
      const key = pathKeyOf(file.destinationPath);
      const listing = listings.find(({ fileByKey }) => {
        const listed = fileByKey.get(key);
        return listed !== undefined && sameFile(listed, file);
      });
      return listing?.stagedFiles.pathOf(file);
    },
  };
}

/**
 * Plans the deployment of a resolved game's profile against the game's last deployed lockfile,
 * before the disk changes. Undefined for other games and on a failure, which is logged and reported.
 */
export async function planDeployment(
  api: IExtensionApi,
  profileId: VortexProfileId,
  hashFile: (filePath: string) => Promise<string> = fileMD5,
): Promise<DeploymentPlan | undefined> {
  pendingPlan = undefined;
  const gameMode = gameIdOfProfile(api.getState(), profileId);
  if (gameMode === undefined || !RESOLVED_GAMES.has(gameMode)) {
    return undefined;
  }
  const figures: PlannerPlanFigures = {};
  // a seed and the resolve that follows it hash mostly the same staged files
  const hashOnce = hashingOnce(hashFile);
  try {
    const previous =
      previousLockfiles.get(gameMode) ?? (await seededLockfile(api, gameMode, hashOnce));
    // out until did-deploy confirms a deployment: one that fails or never finishes may have changed
    // the disk, and the next plan then reseeds
    // TODO(MOD-134): keep it through a run Apply rolls back, which leaves the disk as it describes
    previousLockfiles.delete(gameMode);

    const game = getGame(gameMode);
    const gamePath = api.getState().settings.gameMode.discovered[gameMode]?.path;
    // TODO(MOD-144): add Vortex-generated files (plugins.txt, loadorder.txt) to both lockfiles with
    // withGeneratedFiles once Apply can write them; the plugin persistor writes them until then
    const [resolved, scanned] = await Promise.all([
      timed(async () => {
        const { input, stagedFiles } = await gatherResolverInput(api, profileId, hashOnce);
        return { lockfile: resolve(input), stagedFiles };
      }),
      timed(() =>
        scanDeploymentTargets(
          Object.values(game.getModPaths(gamePath)),
          previous.lockfile.files.map(({ destinationPath }) => destinationPath),
        ),
      ),
    ]);
    const { result: current } = resolved;
    const { lockfile } = current;
    const diskScan = scanned.result;
    figures.resolve_ms = resolved.ms;
    figures.lockfile_files = lockfile.files.length;
    figures.generated_files = lockfile.files.filter(
      (file) => file.source === FileSourceKind.VortexGenerated,
    ).length;
    figures.scan_ms = scanned.ms;
    figures.disk_entries = diskScan.entries.length;
    figures.scan_roots = diskScan.roots.length;

    const { planMs, counts, destinations } = planAndLogOperations(
      gameMode,
      lockfile,
      previous.lockfile,
      diskScan,
      scanned.ms,
    );
    figures.plan_ms = planMs;
    figures.operations = counts;
    keepLastPlan(gameMode, { plannedAt: Temporal.Now.instant(), destinations });
    pendingPlan = { gameMode, current, figures };
    return { lockfile, destinations, stagedFiles: stagedFilesOfPlan(current, previous) };
  } catch (err) {
    log("warn", "failed to plan deployment", { gameMode, error: getErrorMessageOrDefault(err) });
    void emitPlannerPlanEvent(api, gameMode, () => ({
      ...figures,
      error_kind: parseError(err).data.kind,
    }));
    return undefined;
  }
}

/** Keeps a finished deployment's lockfile as its last deployed one and reports the plan run. */
export function registerResolveLockFile(api: IExtensionApi): void {
  previousLockfiles.clear();
  pendingPlan = undefined;

  // the disk changed outside a deployment, so the next plan reseeds from the manifests and a
  // deployment in progress doesn't keep its lockfile
  const forgetPreviousLockfile = (gameMode: VortexGameId | undefined) => {
    if (gameMode !== undefined) {
      previousLockfiles.delete(gameMode);
      if (pendingPlan?.gameMode === gameMode) {
        pendingPlan = undefined;
      }
    }
    return Promise.resolve();
  };
  const forgetProfileGame = (profileId: string) =>
    forgetPreviousLockfile(gameIdOfProfile(api.getState(), VortexProfileId(profileId)));

  api.onAsync<"did-deploy">("did-deploy", async (profileId) => {
    const gameMode = gameIdOfProfile(api.getState(), VortexProfileId(profileId));
    const plan = pendingPlan;
    if (plan === undefined || plan.gameMode !== gameMode) {
      return;
    }
    const { current, figures } = plan;
    pendingPlan = undefined;
    // the lockfile is only what's deployed when every file was placed
    // TODO(MOD-134): remove the failures check once Apply replaces today's deploy; an applied run
    // placed every file
    if (deploymentFailures(api, plan.gameMode).length === 0) {
      previousLockfiles.set(plan.gameMode, current);
    }
    const manifestDiff = await compareWithManifests(api, plan.gameMode, current.lockfile);
    void emitPlannerPlanEvent(api, plan.gameMode, () => ({
      ...figures,
      manifest_diff: manifestDiff,
    }));
  });

  // TODO(MOD-150): remove these two listeners once deploy-single-mod and mod removal run a full
  // Apply deploy
  api.onAsync<"will-remove-mods">("will-remove-mods", (gameId) =>
    forgetPreviousLockfile(VortexGameId(gameId)),
  );
  api.onAsync<"will-deploy-single-mod">("will-deploy-single-mod", (gameId) =>
    forgetPreviousLockfile(VortexGameId(gameId)),
  );
  // TODO(MOD-149): remove these two listeners once purge runs through Apply; a failed purge emits
  // only will-purge, a purge of one mod type only did-purge
  api.onAsync<"will-purge">("will-purge", forgetProfileGame);
  api.onAsync<"did-purge">("did-purge", forgetProfileGame);
}
