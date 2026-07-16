import { generate as shortid } from "shortid";

import {
  AppGameExitedEvent,
  AppGameLaunchedEvent,
  type GameLaunchMethod,
} from "../extensions/analytics/mixpanel/MixpanelEvents";
import { numericNexusGameId } from "../extensions/analytics/mixpanel/numericGameId";
import {
  enabledModCountForProfile,
  lastActiveProfileForGame,
} from "../extensions/profile_management/selectors";
import { makeExeId } from "../reducers/session";
import type { IExtensionApi } from "../types/IExtensionContext";
import type { IState } from "../types/IState";
import type { IStarterInfo } from "./StarterInfo";

interface ILaunchRecord {
  sessionId: string;
  gameId: number | null;
  launchMethod: GameLaunchMethod;
  launchTime: number;
  // Set from runExecutable's exit for Vortex-spawned launches; stays null for store launches.
  exitCode: number | null;
}

// Recorded launches awaiting their exit, keyed by exe id (makeExeId).
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
 * Records the exit code for a launched exe (from runExecutable) so the paired app_game_exited can
 * report it. No-op when the launch isn't tracked, e.g. a store launch Vortex didn't spawn itself.
 */
export function recordLaunchExit(exePath: string, code: number | null): void {
  const record = pendingLaunches.get(makeExeId(exePath));
  if (record !== undefined) {
    record.exitCode = code;
  }
}

/** Emits app_game_exited for each recorded launch whose exe is in `previous` but absent from `current`. */
export function emitExitsForStoppedTools(
  api: IExtensionApi,
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
): void {
  for (const exeId of Object.keys(previous ?? {})) {
    if (current?.[exeId] !== undefined) {
      continue;
    }
    const record = pendingLaunches.get(exeId);
    if (record === undefined) {
      continue;
    }
    pendingLaunches.delete(exeId);
    api.events.emit(
      "analytics-track-mixpanel-event",
      new AppGameExitedEvent({
        game_id: record.gameId,
        launch_method: record.launchMethod,
        launch_session_id: record.sessionId,
        duration_ms: Date.now() - record.launchTime,
        exit_code: record.exitCode,
      }),
    );
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
  pendingLaunches.set(makeExeId(info.exePath), {
    sessionId,
    gameId,
    launchMethod: method,
    launchTime: Date.now(),
    exitCode: null,
  });
  const profileId = lastActiveProfileForGame(state, info.gameId);
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameLaunchedEvent({
      game_id: gameId,
      launch_method: method,
      enabled_mod_count: enabledModCountForProfile(state, profileId),
      launch_session_id: sessionId,
    }),
  );
}
