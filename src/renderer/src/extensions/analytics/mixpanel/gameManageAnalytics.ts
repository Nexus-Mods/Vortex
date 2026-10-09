import type { IExtensionApi } from "../../../types/IExtensionContext";
import { discoveryByGame } from "../../gamemode_management/selectors";
import { getGame } from "../../gamemode_management/util/getGame";
import { AppGameManagedEvent, AppGameUnmanagedEvent } from "./MixpanelEvents";
import { numericNexusGameId } from "./numericGameId";

/**
 * Emits app_game_manage for a game managed for the first time, with its support extension version,
 * the store it was installed from, and whether its folder was found automatically or set by hand.
 */
export function emitGameManaged(api: IExtensionApi, gameId: string): void {
  const discovery = discoveryByGame(api.getState(), gameId);
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameManagedEvent({
      game_id: numericNexusGameId(gameId),
      extension_version: getGame(gameId)?.version ?? "",
      game_store: discovery?.store ?? null,
      discovery_method: discovery?.pathSetManually ? "manual" : "automatic",
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
