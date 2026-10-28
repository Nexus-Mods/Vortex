import {
  DiskEntryKind,
  FileSourceKind,
  OperationKind,
  plan,
  resolve,
  type Lockfile,
} from "@nexusmods/mod-pipeline";
import { getErrorMessageOrDefault, VortexGameId } from "@vortex/shared";

import { log } from "../../../logging";
import type { IRegisteredExtension } from "../../../types/extensions";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { fileMD5 } from "../../../util/checksum";
import Debouncer from "../../../util/Debouncer";
import { getGame } from "../../gamemode_management/util/getGame";
import { lastActiveProfileForGame } from "../../profile_management/selectors";
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

/** The name a contribution is reported under: its extension's name, else its path. */
export function contributorOf(
  extensionPath?: string,
  extInfo?: Partial<IRegisteredExtension>,
): string {
  return extInfo?.name ?? extensionPath ?? "unknown";
}

const registeredContributions = new LockfileContributions();

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

// the lockfile planned last in this session per game, the next plan's previous lockfile
const lastPlannedLockfiles = new Map<VortexGameId, Lockfile>();

const elapsedMsSince = (startedAt: Temporal.Instant) =>
  Temporal.Now.instant().since(startedAt).total("milliseconds");

/** The lockfile planned last for a game, else one seeded from its deployment manifests. */
async function previousLockfile(
  api: IExtensionApi,
  gameMode: VortexGameId,
  hashFile: (filePath: string) => Promise<string>,
): Promise<{ lockfile: Lockfile; seeded: boolean }> {
  const planned = lastPlannedLockfiles.get(gameMode);
  if (planned !== undefined) {
    return { lockfile: planned, seeded: false };
  }
  const startedAt = Temporal.Now.instant();
  const state = api.getState();
  const { input, notes } = await gatherDeployedInput(api, gameMode, hashFile);
  const lockfile = await withGeneratedFiles(
    state,
    gameMode,
    registeredContributions,
    resolve(input),
  );
  log("info", "seeded previous lockfile", {
    gameMode,
    files: lockfile.files.length,
    notes: notes.length,
    firstNotes: notes.slice(0, 5),
    elapsedMs: elapsedMsSince(startedAt),
  });
  return { lockfile, seeded: true };
}

/** Scans the game's deployment targets and logs the plan from the previous lockfile. */
async function logPlan(
  api: IExtensionApi,
  gameMode: VortexGameId,
  lockfile: Lockfile,
  hashFile: (filePath: string) => Promise<string>,
) {
  const game = getGame(gameMode);
  const gamePath = api.getState().settings.gameMode.discovered[gameMode]?.path;
  if (game === undefined || gamePath === undefined) {
    return;
  }
  try {
    const { lockfile: previous, seeded } = await previousLockfile(api, gameMode, hashFile);

    const scanStartedAt = Temporal.Now.instant();
    const disk = await scanDeploymentTargets(
      Object.values(game.getModPaths(gamePath)),
      [...lockfile.files, ...previous.files].map(({ destinationPath }) => destinationPath),
    );
    const scanMs = elapsedMsSince(scanStartedAt);
    const planStartedAt = Temporal.Now.instant();
    const operations = plan(lockfile, previous, disk);
    const planMs = elapsedMsSince(planStartedAt);
    lastPlannedLockfiles.set(gameMode, lockfile);

    const summary = {
      gameMode,
      seededPrevious: seeded,
      roots: disk.roots.length,
      diskEntries: disk.entries.length,
      diskLinks: disk.entries.filter((entry) => entry.kind === DiskEntryKind.Link).length,
      backups: operations.filter((operation) => operation.kind === OperationKind.Backup).length,
      unlinks: operations.filter((operation) => operation.kind === OperationKind.Unlink).length,
      links: operations.filter((operation) => operation.kind === OperationKind.Link).length,
      scanMs,
      planMs,
    };
    log("info", "planned lockfile", summary);
    log("debug", "planned lockfile operations", {
      ...summary,
      operations: operations.map((operation) =>
        operation.kind === OperationKind.Backup
          ? `${operation.kind} ${operation.destinationPath}`
          : `${operation.kind} ${operation.file.destinationPath}`,
      ),
    });
  } catch (err) {
    log("warn", "failed to plan lockfile", {
      gameMode,
      error: getErrorMessageOrDefault(err),
    });
  }
}

async function logResolvedLockfile(
  api: IExtensionApi,
  gameMode: VortexGameId,
  hashFile: (filePath: string) => Promise<string>,
): Promise<void> {
  const startedAt = Temporal.Now.instant();
  let lockfile: Lockfile;
  try {
    lockfile = await resolveLockfile(api, gameMode, registeredContributions, hashFile);

    log("info", "resolved lockfile", {
      gameMode,
      files: lockfile.files.length,
      nexusFiles: lockfile.files.filter((file) => file.source === FileSourceKind.Nexus).length,
      generatedFiles: lockfile.files.filter(
        (file) => file.source === FileSourceKind.VortexGenerated,
      ).length,
      elapsedMs: elapsedMsSince(startedAt),
    });
    log("debug", "resolved lockfile files", {
      gameMode,
      files: lockfile.files.map((file) => file.destinationPath),
    });
  } catch (err) {
    log("warn", "failed to resolve lockfile", {
      gameMode,
      error: getErrorMessageOrDefault(err),
    });
    return;
  }
  await logPlan(api, gameMode, lockfile, hashFile);
}

/**
 * Resolves and logs the lockfile once a plugin sort has run after a deployment. Runs for a game
 * never overlap: sorts during a run lead to one more run after it.
 */
export function registerResolveLockFile(
  api: IExtensionApi,
  hashFile: (filePath: string) => Promise<string> = fileMD5,
): void {
  const runsByGame = new Map<VortexGameId, Debouncer>();
  api.events.on("did-sort-plugins", (gameId: string) => {
    if (!RESOLVED_GAMES.has(gameId)) {
      return;
    }
    const gameMode = VortexGameId(gameId);
    let runs = runsByGame.get(gameMode);
    if (runs === undefined) {
      runs = new Debouncer(() => logResolvedLockfile(api, gameMode, hashFile), 0, false);
      runsByGame.set(gameMode, runs);
    }
    runs.schedule();
  });
}
