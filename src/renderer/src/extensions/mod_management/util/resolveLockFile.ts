import {
  DiskEntryKind,
  FileSourceKind,
  OperationKind,
  plan,
  resolve,
  type DiskScan,
  type Lockfile,
} from "@nexusmods/mod-pipeline";
import type { ManifestDiff, PlannerOperationCounts } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault, parseError, VortexGameId } from "@vortex/shared";

import { log } from "../../../logging";
import type { IRegisteredExtension } from "../../../types/extensions";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { fileMD5 } from "../../../util/checksum";
import { emitPlannerPlanEvent } from "../../analytics/utils/plannerPlanEvent";
import { getGame } from "../../gamemode_management/util/getGame";
import { lastActiveProfileForGame, profileById } from "../../profile_management/selectors";
import { scanDeploymentTargets } from "./diskScan";
import { addGeneratedFiles } from "./generatedFiles";
import {
  LockfileContributions,
  type LockfileContribution,
  type LockfileContributionCondition,
} from "./lockfileContributions";
import { gatherDeployedInput, gatherDeployedOrigins, gatherResolverInput } from "./resolverInput";
import { compareWithDeployment } from "./shadowComparison";

/** The games whose lockfile is resolved after each plugin sort. */
const RESOLVED_GAMES: ReadonlySet<string> = new Set(["skyrimse"]);

/** Prevoius lockfile, empty on first run */
let previousLockfile: Lockfile;

/** The disk as it was before the first deployment since the last plan, and whether a deployment has run since */
let scanBeforeDeployment: { diskScan: DiskScan; scanMs: number; deployed: boolean } | undefined;

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
  contributions: LockfileContributions,
  lockfile: Lockfile,
): Promise<Lockfile> {
  const generatedFiles = await contributions.generatedFiles(
    state,
    gameMode,
    lastActiveProfileForGame(state, gameMode),
  );
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
  const input = await gatherResolverInput(api, gameMode, hashFile);
  return withGeneratedFiles(state, gameMode, contributions, resolve(input));
}

// the key each kind of operation is counted under
const COUNT_KEY_BY_KIND = {
  [OperationKind.Backup]: "backup",
  [OperationKind.Link]: "link",
  [OperationKind.Unlink]: "unlink",
} as const satisfies Record<OperationKind, keyof PlannerOperationCounts>;

const elapsedMsSince = (startedAt: Temporal.Instant) =>
  Temporal.Now.instant().since(startedAt).total("milliseconds");

function planAndLogOperations(
  gameMode: string,
  currentLockfile: Lockfile,
  previousLockfile: Lockfile,
  diskScan: DiskScan,
  scanMs: number,
): { planMs: number; counts: PlannerOperationCounts } {
  // expensive: a line per disk entry, hundreds of thousands on a large setup
  // diskScan.entries.forEach((d) => log("debug", "disk scan", d.path));

  // Now that we have both previous lockfile, current lockfile and the disk state do the actual planning
  const planStartedAt = Temporal.Now.instant();
  const operations = plan(currentLockfile, previousLockfile, diskScan);
  const planMs = elapsedMsSince(planStartedAt);
  const counts: PlannerOperationCounts = { backup: 0, link: 0, unlink: 0 };
  for (const operation of operations) {
    counts[COUNT_KEY_BY_KIND[operation.kind]] += 1;
  }

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
  operations.forEach((o) =>
    log("debug", "planner operations ", {
      operation: o.kind,
      path: o.kind == OperationKind.Backup ? o.destinationPath : o.file.destinationPath,
    }),
  );

  return { planMs, counts };
}

/** Compares the lockfile with the deployment's manifests and logs the result. */
async function compareWithManifests(
  api: IExtensionApi,
  gameId: string,
  lockfile: Lockfile,
): Promise<ManifestDiff | null> {
  try {
    const shadow = compareWithDeployment(
      lockfile,
      await gatherDeployedOrigins(api, VortexGameId(gameId)),
    );
    log("info", "shadow comparison", { gameId, verdict: shadow.verdict, ...shadow.counts });
    return shadow;
  } catch (err) {
    log("warn", "failed to compare with the deployment", {
      gameId,
      error: getErrorMessageOrDefault(err),
    });
    return null;
  }
}

/**
 * Scans the deployment targets before a deployment, then resolves and plans the lockfile once a
 * plugin sort has run after it.
 */
export function registerResolveLockFile(
  api: IExtensionApi,
  hashFile: (filePath: string) => Promise<string> = fileMD5,
): void {
  const scanBeforeDiskChange = async (gameId: string | undefined) => {
    // disk changes before the next plan, as a collection install makes, keep the first scan
    if (!RESOLVED_GAMES.has(gameId) || scanBeforeDeployment !== undefined) {
      return;
    }
    try {
      const gameMode = VortexGameId(gameId);

      if (previousLockfile === undefined) {
        const startedAt = Temporal.Now.instant();
        const state = api.getState();
        const { input, notes } = await gatherDeployedInput(api, gameMode, hashFile);
        previousLockfile = await withGeneratedFiles(
          state,
          gameMode,
          registeredContributions,
          resolve(input),
        );
        // expensive: a line per file, hundreds of thousands on a large setup
        // previousLockfile.files.forEach((f) => log("debug", "previous lockfile", f.destinationPath));
        log("info", "seeded previous lockfile from manifest", {
          gameMode,
          files: previousLockfile.files.length,
          notes: notes.length,
          firstNotes: notes.slice(0, 5),
          elapsedMs: elapsedMsSince(startedAt),
        });
      }

      // Get the disk state before the deployment changes it
      const game = getGame(gameMode);
      const gamePath = api.getState().settings.gameMode.discovered[gameMode]?.path;
      const scanStartedAt = Temporal.Now.instant();
      const diskScan = await scanDeploymentTargets(
        Object.values(game.getModPaths(gamePath)),
        previousLockfile.files.map(({ destinationPath }) => destinationPath),
      );
      scanBeforeDeployment = { diskScan, scanMs: elapsedMsSince(scanStartedAt), deployed: false };
    } catch (err) {
      log("warn", "failed to scan before deployment", {
        gameId,
        error: getErrorMessageOrDefault(err),
      });
      void emitPlannerPlanEvent(api, gameId, () => ({ error_kind: parseError(err).data.kind }));
    }
  };

  api.onAsync<"will-deploy">("will-deploy", (profileId) =>
    scanBeforeDiskChange(profileById(api.getState(), profileId)?.gameId),
  );
  // removing mods and deploying a single mod change the disk outside a deployment
  api.onAsync<"will-remove-mods">("will-remove-mods", scanBeforeDiskChange);
  api.onAsync<"will-deploy-single-mod">("will-deploy-single-mod", scanBeforeDiskChange);

  api.onAsync<"did-deploy">("did-deploy", (profileId) => {
    if (
      scanBeforeDeployment &&
      RESOLVED_GAMES.has(profileById(api.getState(), profileId)?.gameId)
    ) {
      scanBeforeDeployment.deployed = true;
    }
    return Promise.resolve();
  });

  api.events.on("did-sort-plugins", async (gameId: string) => {
    // only a sort after a deployment plans; changes not deployed yet stay for the next one
    if (!RESOLVED_GAMES.has(gameId) || scanBeforeDeployment?.deployed !== true) {
      return;
    }
    const { diskScan, scanMs } = scanBeforeDeployment;
    scanBeforeDeployment = undefined;
    const scanFigures = {
      disk_entries: diskScan.entries.length,
      scan_roots: diskScan.roots.length,
      scan_ms: scanMs,
    };
    try {
      // Create the current lockfile from state
      const resolveStartedAt = Temporal.Now.instant();
      const currentLockfile = await resolveLockfile(
        api,
        VortexGameId(gameId),
        registeredContributions,
        hashFile,
      );
      const resolveMs = elapsedMsSince(resolveStartedAt);
      // expensive: a line per file, hundreds of thousands on a large setup
      // currentLockfile.files.forEach((f) => log("debug", "current lockfile", f.destinationPath));
      const { planMs, counts } = planAndLogOperations(
        gameId,
        currentLockfile,
        previousLockfile,
        diskScan,
        scanMs,
      );

      previousLockfile = currentLockfile;
      const manifestDiff = await compareWithManifests(api, gameId, currentLockfile);
      void emitPlannerPlanEvent(api, gameId, () => ({
        ...scanFigures,
        resolve_ms: resolveMs,
        lockfile_files: currentLockfile.files.length,
        generated_files: currentLockfile.files.filter(
          (file) => file.source === FileSourceKind.VortexGenerated,
        ).length,
        plan_ms: planMs,
        operations: counts,
        manifest_diff: manifestDiff,
      }));
    } catch (err) {
      log("warn", "failed to plan lockfile", { gameId, error: getErrorMessageOrDefault(err) });
      void emitPlannerPlanEvent(api, gameId, () => ({
        ...scanFigures,
        error_kind: parseError(err).data.kind,
      }));
    }
  });
}
