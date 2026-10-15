import type { IGameStored } from "@/types/IState";

import { numericGameIdToDomainName } from "../../../nexus_integration/util";
import { convertGameIdReverse } from "../../../nexus_integration/util/convertGameId";
import type { IDetectedGame } from "../../types/IDetectedGame";

/**
 * Whether the Games page can list a detected game. That is when the endpoint returned an
 * extension for it, or Vortex already knows the game because an extension is installed: the
 * endpoint returns no extension for the ones bundled with Vortex.
 */
export function isListableDetectedGame(
  game: IDetectedGame,
  internalId: string,
  knownGames: IGameStored[],
): boolean {
  return game.extension !== undefined || knownGames.some((known) => known.id === internalId);
}

/**
 * The ids of the detected games the Games page can list, to tell which a scan newly found.
 */
export function listableDetectedIds(
  detected: IDetectedGame[],
  knownGames: IGameStored[] = [],
): string[] {
  return detected
    .filter((game) => {
      const domain = numericGameIdToDomainName(game.gameId);
      const internalId =
        domain === undefined ? undefined : convertGameIdReverse(knownGames, domain);
      return isListableDetectedGame(game, internalId, knownGames);
    })
    .map((game) => game.gameUid);
}
