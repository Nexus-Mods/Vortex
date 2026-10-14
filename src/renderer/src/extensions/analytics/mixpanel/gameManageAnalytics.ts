import type { IExtensionApi } from "../../../types/IExtensionContext";
import { discoveryByGame } from "../../gamemode_management/selectors";
import type { GameSource } from "../../gamemode_management/types/GameSource";
import { getGame } from "../../gamemode_management/util/getGame";
import { AppGameManagedEvent, AppGameUnmanagedEvent } from "./MixpanelEvents";
import { numericNexusGameId } from "./numericGameId";

/**
 * Emits app_game_manage for a game managed for the first time, with its support extension version,
 * the store it was installed from, whether its folder was found automatically or set by hand,
 * and which Games page list it was picked from.
 */
export function emitGameManaged(api: IExtensionApi, gameId: string): void {
  const state = api.getState();
  const discovery = discoveryByGame(state, gameId);
  // The tile click recorded the list it came from keyed by game id, so a stale origin
  // can't leak into a different game. The event only fires on the add that created the
  // first profile, so the origin never needs clearing.
  const origin = state.session?.gameMode?.gameAddOrigin;
  const gameSource: GameSource | null = origin?.gameId === gameId ? origin.source : null;
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameManagedEvent({
      game_id: numericNexusGameId(gameId),
      extension_version: getGame(gameId)?.version ?? "",
      game_store: discovery?.store ?? null,
      discovery_method: discovery?.pathSetManually ? "manual" : "automatic",
      game_source: gameSource,
    }),
  );
}

/** Emits app_game_unmanage for a game the user stopped managing. */
export function emitGameUnmanaged(api: IExtensionApi, gameId: string): void {
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameUnmanagedEvent({ game_id: numericNexusGameId(gameId) }),
  );
}
