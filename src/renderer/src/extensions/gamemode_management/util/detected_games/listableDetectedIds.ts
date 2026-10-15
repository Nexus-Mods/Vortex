import type { IGameStored } from "@/types/IState";

import { numericGameIdToDomainName } from "../../../nexus_integration/util";
import type { IDetectedGame } from "../../types/IDetectedGame";
import type { IDiscoveryResult } from "../../types/IDiscoveryResult";
import { detectedInternalId } from "./detectedInternalId";
import { locallyDetectedGames } from "./locallyDetectedGames";

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
 * The ids of the games the Games page's detected section can list, to tell which a scan
 * newly found: the response's games by their uid, then the games only discovery found by
 * their internal id. A game both found is counted once, by its uid.
 */
export function listableDetectedIds(
  detected: IDetectedGame[],
  knownGames: IGameStored[] = [],
  discovered: { [gameId: string]: IDiscoveryResult } = {},
  addedGameIds: ReadonlySet<string> = new Set(),
): string[] {
  const ids: string[] = [];
  const listedIds = new Set<string>();

  for (const game of detected) {
    const domain = numericGameIdToDomainName(game.gameId);
    const internalId =
      domain === undefined ? undefined : detectedInternalId(knownGames, discovered, domain);
    if (isListableDetectedGame(game, internalId, knownGames)) {
      ids.push(game.gameUid);
      if (internalId !== undefined) {
        listedIds.add(internalId);
      }
    }
  }

  // Hidden games are counted, as the response's are: hiding one isn't finding it.
  const local = locallyDetectedGames(knownGames, discovered, {
    addedGameIds,
    includeHidden: true,
    listedIds,
  });

  return [...ids, ...local.map((game) => game.id)];
}
