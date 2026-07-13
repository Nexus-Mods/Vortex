import type { IExtensionApi } from "../../../types/IExtensionContext";
import { getGame } from "../../gamemode_management/util/getGame";
import { nexusGames } from "../../nexus_integration/util";
import { nexusGameId } from "../../nexus_integration/util/convertGameId";
import { AppGameManagedEvent, AppGameUnmanagedEvent } from "./MixpanelEvents";

/** Numeric Nexus game id for an internal game id, matching the other analytics events; null when unresolved. */
function toNumericGameId(internalGameId: string): number | null {
  const domain = nexusGameId(getGame(internalGameId), internalGameId);
  return nexusGames().find((game) => game.domain_name === domain)?.id ?? null;
}

/** Emits app_game_manage for a game managed for the first time, with its support extension version. */
export function emitGameManaged(api: IExtensionApi, gameId: string): void {
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameManagedEvent({
      game_id: toNumericGameId(gameId),
      extension_version: getGame(gameId)?.version ?? "",
    }),
  );
}

/** Emits app_game_unmanage for a game the user stopped managing. */
export function emitGameUnmanaged(api: IExtensionApi, gameId: string): void {
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameUnmanagedEvent({ game_id: toNumericGameId(gameId) }),
  );
}
