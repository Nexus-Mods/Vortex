/**
 * Decides when a game's folder check runs: once per game, after the game is managed and the
 * settle time has passed, while Vortex isn't touching the game folder. Activity that starts
 * mid-check cancels it, and it runs again at the next idle moment.
 */
import { getErrorMessageOrDefault, VortexGameId } from "@vortex/shared";

import { setGameFolderCheckMarker } from "@/extensions/analytics/actions/telemetry.action";
import type { IGameFolderCheckMarker } from "@/extensions/analytics/types/telemetry";

import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { log } from "../../../util/log";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { numericNexusGameId } from "../mixpanel/numericGameId";
import { flaggedGameFolderCheckConfig, type IGameFolderCheckConfig } from "./config";
import { isSteamGame, steamCheckInput } from "./steamInput";

// activity ids under which Vortex writes to a game folder
const FOLDER_ACTIVITIES = ["mods", "dependencies", "plugins"];

export function isVortexIdle(state: IState): boolean {
  const activity = state.session.base.activity ?? {};
  if (FOLDER_ACTIVITIES.some((id) => (activity[id] ?? []).length > 0)) return false;
  return Object.keys(state.session.base.toolsRunning ?? {}).length === 0;
}

export function gameFolderCheckMarkers(state: IState): Record<string, IGameFolderCheckMarker> {
  return state.persistent.analyticsTelemetry?.gameFolderChecks ?? {};
}

/** The same gates as store_game_version, plus Steam on Windows. */
export function canCheckGame(state: IState, gameId: VortexGameId): boolean {
  return (
    process.platform === "win32" &&
    isTelemetryEnabled(state) &&
    isLoggedIn(state) &&
    numericNexusGameId(gameId) !== null &&
    isSteamGame(state, gameId)
  );
}

/** A pending check whose settle time has passed, or how long until the next one's has. */
export function nextDueCheck(
  markers: Record<string, IGameFolderCheckMarker>,
  skip: ReadonlySet<VortexGameId>,
  settleMs: number,
  now: number,
): { gameId: VortexGameId } | { waitMs: number } | undefined {
  let waitMs: number | undefined;
  for (const [key, marker] of Object.entries(markers)) {
    // markers are keyed by the Vortex game id
    const gameId = VortexGameId(key);
    if (marker.state !== "pending" || skip.has(gameId)) continue;
    const dueIn = marker.managedAt + settleMs - now;
    if (dueIn <= 0) return { gameId };
    waitMs = Math.min(waitMs ?? dueIn, dueIn);
  }
  return waitMs === undefined ? undefined : { waitMs };
}

/** Marks a newly managed game for a check, if checks are on and the game qualifies. */
export function queueGameFolderCheck(api: IExtensionApi, gameId: VortexGameId): void {
  const state = api.getState();
  if (gameFolderCheckMarkers(state)[gameId] !== undefined) return;
  if (flaggedGameFolderCheckConfig() === undefined || !canCheckGame(state, gameId)) return;
  api.store.dispatch(
    setGameFolderCheckMarker({ gameId, marker: { state: "pending", managedAt: Date.now() } }),
  );
}

export class GameFolderCheckScheduler {
  readonly #api: IExtensionApi;
  #running: VortexGameId | undefined;
  #cancelledRunning = false;
  /** failed this session; retried in the next one */
  readonly #failed = new Set<VortexGameId>();
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(api: IExtensionApi) {
    this.#api = api;
  }

  readonly tick = (): void => {
    clearTimeout(this.#timer);
    const state = this.#api.getState();
    if (this.#running !== undefined) {
      if (!isVortexIdle(state) && !this.#cancelledRunning) {
        this.#cancelledRunning = true;
        window.api.gameFolderCheck.cancel(this.#running);
      }
      return;
    }
    const config = flaggedGameFolderCheckConfig();
    if (config === undefined || !isVortexIdle(state)) return;

    const next = nextDueCheck(
      gameFolderCheckMarkers(state),
      this.#failed,
      config.settleMs,
      Date.now(),
    );
    if (next === undefined) return;
    if ("waitMs" in next) {
      this.#timer = setTimeout(this.tick, next.waitMs);
    } else if (canCheckGame(state, next.gameId)) {
      void this.#run(next.gameId, config);
    } else {
      // stays pending; tried again next session
      this.#failed.add(next.gameId);
      this.tick();
    }
  };

  async #run(gameId: VortexGameId, config: IGameFolderCheckConfig): Promise<void> {
    this.#running = gameId;
    this.#cancelledRunning = false;
    try {
      const fullVerify = Math.random() * 100 < config.fullVerifyPercent;
      const input = await steamCheckInput(this.#api.getState(), gameId, config.limits, fullVerify);
      if (input === undefined) {
        this.#failed.add(gameId);
        return;
      }
      await window.api.gameFolderCheck.start(input);
      // a sent check marks the game done; only a cancel should leave it pending for this session
      const marker = gameFolderCheckMarkers(this.#api.getState())[gameId];
      if (!this.#cancelledRunning && marker?.state === "pending") this.#failed.add(gameId);
    } catch (err) {
      this.#failed.add(gameId);
      log("warn", "game folder check failed", { gameId, error: getErrorMessageOrDefault(err) });
    } finally {
      this.#running = undefined;
      this.tick();
    }
  }
}
