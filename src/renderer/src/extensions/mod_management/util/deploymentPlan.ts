import {
  DiskEntryKind,
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
import type { PlannerOperationCounts } from "@vortex/nexus-api-v3";
import type { VortexGameId, VortexProfileId } from "@vortex/shared";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { getGame } from "../../gamemode_management/util/getGame";
import { BACKUP_TAG } from "../LinkingDeployment";
import {
  apply,
  type ApplyOptions,
  type ApplyResult,
  type RunOptions,
  type StagedFiles,
} from "./apply/apply";
import { scanDeploymentTargets } from "./diskScan";
import { countByOperation } from "./planTree";
import { gatherDeployedInput, gatherResolverInput } from "./resolverInput";

/** A lockfile, and where its files are staged. */
export interface StagedLockfile {
  lockfile: Lockfile;
  stagedFiles: StagedFiles;
}

/** A deployment's plan: its lockfile, every destination as planned, and where its files are staged. */
export interface DeploymentPlan {
  lockfile: Lockfile;
  /** the lockfile it was planned against, which stays deployed when Apply refuses or rolls it back */
  previous: StagedLockfile;
  destinations: PlannedDestination[];
  stagedFiles: StagedFiles;
}

/** The disk and journal an Apply run uses, and where it sets files aside. */
export type ApplyRun = RunOptions & Pick<ApplyOptions, "keptPathOf">;

type HashFile = (filePath: string) => Promise<string>;

/** Where a BACKUP moves the game's original, and a RESTORE finds it. */
export const backupPathOf = (destinationPath: string) => destinationPath + BACKUP_TAG;

const elapsedMsSince = (startedAt: Temporal.Instant) =>
  Temporal.Now.instant().since(startedAt).total("milliseconds");

/** What `run` returns, and how long it took. */
async function timed<T>(run: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const startedAt = Temporal.Now.instant();
  const result = await run();
  return { result, ms: elapsedMsSince(startedAt) };
}

/** `hashFile`, hashing each path once. */
export function hashingOnce(hashFile: HashFile): HashFile {
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

/** The lockfile the deployment manifests list, without generated files. */
export async function seededLockfile(
  api: IExtensionApi,
  gameMode: VortexGameId,
  hashFile: HashFile,
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

const operationsInApplyOrder = (destinations: readonly PlannedDestination[]) =>
  inApplyOrder(destinations.flatMap((destination) => destination.operations));

export function planAndLogOperations(
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
    backupPathOf,
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
  operationsInApplyOrder(destinations).forEach((o) =>
    log("debug", "planner operations ", {
      operation: o.kind,
      path: "file" in o ? o.file.destinationPath : o.destinationPath,
    }),
  );

  return { planMs, counts, destinations };
}

/**
 * Resolves the profile's lockfile while it scans the game's mod paths and the destinations
 * `previous` lists.
 */
export async function resolveAndScan(
  api: IExtensionApi,
  gameMode: VortexGameId,
  profileId: VortexProfileId,
  previous: Lockfile,
  hashFile: HashFile,
): Promise<{ current: StagedLockfile; resolveMs: number; diskScan: DiskScan; scanMs: number }> {
  const game = getGame(gameMode);
  const gamePath = api.getState().settings.gameMode.discovered[gameMode]?.path;
  // TODO(MOD-144): add Vortex-generated files (plugins.txt, loadorder.txt) to both lockfiles with
  // withGeneratedFiles once Apply can write them; the plugin persistor writes them until then
  const [resolved, scanned] = await Promise.all([
    timed(async () => {
      const { input, stagedFiles } = await gatherResolverInput(api, profileId, hashFile);
      return { lockfile: resolve(input), stagedFiles };
    }),
    timed(() =>
      scanDeploymentTargets(
        Object.values(game.getModPaths(gamePath)),
        previous.files.map(({ destinationPath }) => destinationPath),
      ),
    ),
  ]);
  return {
    current: resolved.result,
    resolveMs: resolved.ms,
    diskScan: scanned.result,
    scanMs: scanned.ms,
  };
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

/** The plan that takes the game from `previous` to `current` through `destinations`. */
export function deploymentPlanOf(
  current: StagedLockfile,
  previous: StagedLockfile,
  destinations: PlannedDestination[],
): DeploymentPlan {
  return {
    lockfile: current.lockfile,
    previous,
    destinations,
    stagedFiles: stagedFilesOfPlan(current, previous),
  };
}

/** Runs a plan's operations through Apply, with the backup paths they were planned with. */
export function applyPlan(plan: DeploymentPlan, run: ApplyRun): Promise<ApplyResult> {
  return apply(operationsInApplyOrder(plan.destinations), {
    ...run,
    stagedFiles: plan.stagedFiles,
    backupPathOf,
  });
}
