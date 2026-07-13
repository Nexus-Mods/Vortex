import type { IExtensionApi } from "../../../types/IExtensionContext";
import { getGame } from "../../gamemode_management/util/getGame";
import { AppGameManagedEvent, AppGameUnmanagedEvent } from "./MixpanelEvents";
import { numericNexusGameId } from "./numericGameId";

/** Emits app_game_manage for a game managed for the first time, with its support extension version. */
export function emitGameManaged(api: IExtensionApi, gameId: string): void {
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameManagedEvent({
      game_id: numericNexusGameId(gameId),
      extension_version: getGame(gameId)?.version ?? "",
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
