import { generate as shortid } from "shortid";

import {
  AppGameExitedEvent,
  AppGameLaunchedEvent,
  type GameLaunchMethod,
} from "../extensions/analytics/mixpanel/MixpanelEvents";
import { numericNexusGameId } from "../extensions/analytics/mixpanel/numericGameId";
import { getGame } from "../extensions/gamemode_management/util/getGame";
import {
  enabledModCountForProfile,
  lastActiveProfileForGame,
} from "../extensions/profile_management/selectors";
import { isExeIdRunning, makeExeId } from "../reducers/session";
import type { IExtensionApi } from "../types/IExtensionContext";
import type { IState } from "../types/IState";
import type { IStarterInfo } from "./StarterInfo";

// A launch that hands off to the game (script extender / mod loader) exits its launcher within
// seconds while the game keeps running, so we wait for the game process to appear. If it never
// does (failed or undetected launch) emit a best-effort exit after this long. Generous so a game
// behind a store launcher or shader compile isn't cut off early.
const GAME_START_TIMEOUT_MS = 5 * 60 * 1000;

interface ILaunchRecord {
  sessionId: string;
  gameId: number | null;
  launchMethod: GameLaunchMethod;
  enabledModCount: number;
  launchTime: number;
  // Set from runExecutable's exit for Vortex-spawned launches; stays null for store launches.
  exitCode: number | null;
  // Exe id whose stop ends the play session. For a script-extender / mod-loader launch this is the
  // game's own executable, not the launched loader (which exits during the handoff).
  watchExeId: string;
  // Whether watchExeId has been seen running. A handoff launch starts false until the game process
  // appears; other launches start true because the launched exe is already running.
  started: boolean;
  // Fires a best-effort exit if the game process never appears. Cleared once the game is seen.
  startTimer: ReturnType<typeof setTimeout> | undefined;
}

// Recorded launches awaiting their exit, keyed by the launched exe id (makeExeId of info.exePath).
const pendingLaunches = new Map<string, ILaunchRecord>();
let exitWatcherInstalled = false;

function launchMethod(info: IStarterInfo): GameLaunchMethod {
  if (info.isGame) {
    return info.store ? "store" : "direct_exe";
  }
  // Extensions flag script-extender tools (skse64, f4se, ...) with defaultPrimary.
  return info.defaultPrimary ? "script_extender" : "tool";
}

/**
 * True when a launch actually starts the game, as opposed to a plain utility tool. That means the
 * game itself, the extension's defaultPrimary launcher (script extenders, and mod loaders like
 * SMAPI), or a tool the user has bound as the game's primary launcher. A utility tool run from the
 * tools dashlet is none of these, so its session stays tied to its own process.
 */
function launchRunsGame(info: IStarterInfo, state: IState): boolean {
  if (info.isGame || (info.defaultPrimary ?? false)) {
    return true;
  }
  // A user can bind a non-defaultPrimary tool as the launcher. primaryTool is an extension-added
  // slice, not part of the base IState type.
  const primaryTool = (state.settings?.interface as { primaryTool?: Record<string, string> })
    ?.primaryTool?.[info.gameId];
  return primaryTool === info.id;
}

/** Resolves the game's executable id (normalized basename) for a game id, or undefined. */
function gameExecutableId(state: IState, gameId: string): string | undefined {
  const discovered = state.settings?.gameMode?.discovered?.[gameId];
  const discoveredExe = discovered?.executable;
  if (typeof discoveredExe === "string" && discoveredExe.length > 0) {
    return makeExeId(discoveredExe);
  }
  const game = getGame(gameId);
  if (game !== undefined && typeof game.executable === "function") {
    try {
      const exe = game.executable(discovered?.path);
      if (typeof exe === "string" && exe.length > 0) {
        return makeExeId(exe);
      }
    } catch {
      // dynamic executable() that needs a discovery path we don't have; fall through
    }
  }
  return undefined;
}

function clearStartTimer(record: ILaunchRecord): void {
  if (record.startTimer !== undefined) {
    clearTimeout(record.startTimer);
    record.startTimer = undefined;
  }
}

// reliable is true when the watched process was observed running and then stopped, so duration_ms
// is the real session; false for a best-effort exit fired because the game process never appeared.
function emitExited(api: IExtensionApi, record: ILaunchRecord, reliable: boolean): void {
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameExitedEvent({
      game_id: record.gameId,
      launch_method: record.launchMethod,
      enabled_mod_count: record.enabledModCount,
      launch_session_id: record.sessionId,
      duration_ms: Date.now() - record.launchTime,
      duration_reliable: reliable,
      exit_code: record.exitCode,
    }),
  );
}

/**
 * Records the exit code for a launched exe (from runExecutable) so the paired app_game_exited can
 * report it. No-op when the launch isn't tracked, e.g. a store launch Vortex didn't spawn itself.
 */
export function recordLaunchExit(exePath: string, code: number | null): void {
  const record = pendingLaunches.get(makeExeId(exePath));
  if (record !== undefined) {
    record.exitCode = code;
  }
}

/**
 * Emits app_game_exited for tracked launches whose watched process has stopped. Each launch watches
 * either its own exe (direct/store/tool) or, for a script-extender / mod-loader handoff, the game's
 * executable. A handoff launch only counts as exited once the game process has been seen running
 * and then disappears.
 */
export function emitExitsForStoppedTools(
  api: IExtensionApi,
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
): void {
  for (const [key, record] of [...pendingLaunches.entries()]) {
    const wasRunning = isExeIdRunning(previous, record.watchExeId);
    const isRunning = isExeIdRunning(current, record.watchExeId);

    if (!record.started && isRunning) {
      // The watched (game) process has come up; from here its disappearance ends the session.
      record.started = true;
      clearStartTimer(record);
    }

    if (record.started && wasRunning && !isRunning) {
      clearStartTimer(record);
      pendingLaunches.delete(key);
      emitExited(api, record, true);
    }
  }
}

/** Installs the toolsRunning watcher that emits app_game_exited, once per session. */
function ensureExitWatcher(api: IExtensionApi): void {
  if (exitWatcherInstalled || api.onStateChange === undefined) {
    return;
  }
  exitWatcherInstalled = true;
  api.onStateChange(
    ["session", "base", "toolsRunning"],
    (previous: Record<string, unknown>, current: Record<string, unknown>) =>
      emitExitsForStoppedTools(api, previous, current),
  );
}

/** Emits app_game_launched and ensures the exit watcher is installed for the paired app_game_exited. */
export function emitGameLaunched(api: IExtensionApi, info: IStarterInfo): void {
  ensureExitWatcher(api);
  const state: IState = api.getState();
  const gameId = numericNexusGameId(info.gameId);
  const sessionId = shortid();
  const method = launchMethod(info);
  const profileId = lastActiveProfileForGame(state, info.gameId);
  const enabledModCount = enabledModCountForProfile(state, profileId);
  const launchedExeId = makeExeId(info.exePath);

  // A launch that hands the game off to a separate process (script extender / mod loader) watches
  // the game executable; every other launch watches the exe it started. A handoff waits for the
  // game process to appear, so it is only "started" once that process is running.
  const gameExeId = launchRunsGame(info, state) ? gameExecutableId(state, info.gameId) : undefined;
  let watchExeId = launchedExeId;
  let started = true;
  if (gameExeId !== undefined && gameExeId !== launchedExeId) {
    watchExeId = gameExeId;
    started = isExeIdRunning(state.session?.base?.toolsRunning ?? {}, gameExeId);
  }

  const record: ILaunchRecord = {
    sessionId,
    gameId,
    launchMethod: method,
    enabledModCount,
    launchTime: Date.now(),
    exitCode: null,
    watchExeId,
    started,
    startTimer: undefined,
  };
  pendingLaunches.set(launchedExeId, record);

  if (!started) {
    record.startTimer = setTimeout(() => {
      if (pendingLaunches.get(launchedExeId) === record && !record.started) {
        pendingLaunches.delete(launchedExeId);
        emitExited(api, record, false);
      }
    }, GAME_START_TIMEOUT_MS);
  }

  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameLaunchedEvent({
      game_id: gameId,
      launch_method: method,
      enabled_mod_count: enabledModCount,
      launch_session_id: sessionId,
    }),
  );
}
