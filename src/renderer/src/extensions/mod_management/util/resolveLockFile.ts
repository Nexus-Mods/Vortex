import {
  DiskEntryKind,
  Operation,
  OperationKind,
  plan,
  resolve,
  type Lockfile,
} from "@nexusmods/mod-pipeline";
import { VortexGameId } from "@vortex/shared";

import { log } from "../../../logging";
import type { IRegisteredExtension } from "../../../types/extensions";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { fileMD5 } from "../../../util/checksum";
import { getGame } from "../../gamemode_management/util/getGame";
import { lastActiveProfileForGame, profileById } from "../../profile_management/selectors";
import { scanDeploymentTargets } from "./diskScan";
import { addGeneratedFiles } from "./generatedFiles";
import {
  LockfileContributions,
  type LockfileContribution,
  type LockfileContributionCondition,
} from "./lockfileContributions";
import { gatherDeployedInput, gatherResolverInput } from "./resolverInput";

/** The games whose lockfile is resolved after each plugin sort. */
const RESOLVED_GAMES: ReadonlySet<string> = new Set(["skyrimse"]);

/** Prevoius lockfile, empty on first run */
let previousLockfile: Lockfile;

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

const elapsedMsSince = (startedAt: Temporal.Instant) =>
  Temporal.Now.instant().since(startedAt).total("milliseconds");

async function planAndLogOperations(
  api: IExtensionApi,
  gameMode: string,
  currentLockfile: Lockfile,
  previousLockfile: Lockfile,
): Promise<Operation[]> {
  // We need all paths, previous and current since some paths can be removed from the new lockfile contributions
  // we need to do a disk scan also for old files.
  let paths: string[] = [];
  if (previousLockfile === undefined) {
    paths = currentLockfile.files.map(({ destinationPath }) => destinationPath);
  } else {
    paths = [
      ...currentLockfile.files.map(({ destinationPath }) => destinationPath),
      ...previousLockfile.files.map(({ destinationPath }) => destinationPath),
    ];
  }

  // Get the disk state
  const game = getGame(gameMode);
  const gamePath = api.getState().settings.gameMode.discovered[gameMode]?.path;
  const scanStartedAt = Temporal.Now.instant();
  const diskScan = await scanDeploymentTargets(Object.values(game.getModPaths(gamePath)), paths);
  const scanMs = elapsedMsSince(scanStartedAt);

  // Debug log
  diskScan.entries.forEach((d) => log("debug", "disk scan", d.path));

  // Now that we have both previous lockfile, current lockfile and the disk state do the actual planning
  const planStartedAt = Temporal.Now.instant();
  const operations = plan(currentLockfile, previousLockfile, diskScan);
  const planMs = elapsedMsSince(planStartedAt);

  log("info", "planner operations", {
    gameMode,
    roots: diskScan.roots.length,
    diskEntries: diskScan.entries.length,
    diskLinks: diskScan.entries.filter((entry) => entry.kind === DiskEntryKind.Link).length,
    backups: operations.filter((operation) => operation.kind === OperationKind.Backup).length,
    unlinks: operations.filter((operation) => operation.kind === OperationKind.Unlink).length,
    links: operations.filter((operation) => operation.kind === OperationKind.Link).length,
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

  return operations;
}

/**
 * Resolves and logs the lockfile once a plugin sort has run after a deployment. Runs for a game
 * never overlap: sorts during a run lead to one more run after it.
 */
export function registerResolveLockFile(
  api: IExtensionApi,
  hashFile: (filePath: string) => Promise<string> = fileMD5,
): void {
  api.onAsync<"will-deploy">("will-deploy", async (profileId) => {});

  api.events.on("did-sort-plugins", async (gameId: string) => {});

  api.onAsync(
    "did-enable-mods",
    async (res: void, profileId: string, modIds: string[], enable: boolean) => {
      const gameId = profileById(api.getState(), profileId)?.gameId;
      if (!RESOLVED_GAMES.has(gameId)) {
        return;
      }

      log("debug", "registerResolveLockfile on did-enable-mods");
      log("debug", "registerResolveLockFile", profileId);

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
        previousLockfile.files.forEach((f) => log("debug", "previous lockfile", f.destinationPath));
        log("info", "seeded previous lockfile from manifest", {
          gameMode,
          files: previousLockfile.files.length,
          notes: notes.length,
          firstNotes: notes.slice(0, 5),
          elapsedMs: elapsedMsSince(startedAt),
        });
      }

      // Create the current lockfile from state
      let currentLockfile = await resolveLockfile(api, gameMode, registeredContributions, hashFile);
      currentLockfile.files.forEach((f) => log("debug", "current lockfile", f.destinationPath));
      await planAndLogOperations(api, gameId, currentLockfile, previousLockfile);

      previousLockfile = currentLockfile;
    },
  );
}
