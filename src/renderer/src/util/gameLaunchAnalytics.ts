import { generate as shortid } from "shortid";

import {
  AppGameExitedEvent,
  AppGameLaunchedEvent,
  type GameLaunchMethod,
} from "../extensions/analytics/mixpanel/MixpanelEvents";
import { getGame } from "../extensions/gamemode_management/util/getGame";
import { nexusGames } from "../extensions/nexus_integration/util";
import { nexusGameId } from "../extensions/nexus_integration/util/convertGameId";
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
  launchTime: number;
}

// Recorded launches awaiting their exit, keyed by exe id (makeExeId).
const pendingLaunches = new Map<string, ILaunchRecord>();
let exitWatcherInstalled = false;

/** Numeric Nexus game id for an internal game id, matching the other analytics events; null when unresolved. */
function toNumericGameId(internalGameId: string): number | null {
  const domain = nexusGameId(getGame(internalGameId), internalGameId);
  return nexusGames().find((game) => game.domain_name === domain)?.id ?? null;
}

function launchMethod(info: IStarterInfo): GameLaunchMethod {
  if (info.isGame) {
    return info.store ? "store" : "direct_exe";
  }
  // Extensions flag script-extender tools (skse64, f4se, ...) with defaultPrimary.
  return info.defaultPrimary ? "script_extender" : "tool";
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
        launch_session_id: record.sessionId,
        duration_ms: Date.now() - record.launchTime,
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
  const gameId = toNumericGameId(info.gameId);
  const sessionId = shortid();
  pendingLaunches.set(makeExeId(info.exePath), { sessionId, gameId, launchTime: Date.now() });
  const profileId = lastActiveProfileForGame(state, info.gameId);
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameLaunchedEvent({
      game_id: gameId,
      launch_method: launchMethod(info),
      enabled_mod_count: enabledModCountForProfile(state, profileId),
      launch_session_id: sessionId,
    }),
  );
}
