import type { GameId, VortexGameId } from "@vortex/shared";

import type { IGameStored } from "@/types/IState";

import { numericGameIdToDomainName } from "../../../nexus_integration/util";
import type { IDetectedGame } from "../../types/IDetectedGame";
import type { IDiscoveryResult } from "../../types/IDiscoveryResult";
import { detectedInternalId } from "./detectedInternalId";
import { locallyDetectedGames } from "./locallyDetectedGames";

export interface IListableOptions {
  /** Tier 0 flag on: entries without an extension may be managed without one */
  allowTierZero?: boolean;
  /** numeric Nexus ids of the games an extension in the catalog provides support for */
  extensionGameIds?: ReadonlySet<GameId>;
}

/**
 * Whether the entry may be managed without a game extension (as a Tier 0 game): the
 * endpoint gave no extension for it and none in the catalog provides one, so the
 * supported section doesn't list it and the extension-download dialog doesn't apply.
 */
export function isTierZeroCandidate(
  entry: IDetectedGame,
  extensionGameIds: ReadonlySet<GameId>,
): boolean {
  return entry.extension === undefined && !extensionGameIds.has(entry.gameId);
}

/**
 * Whether the Games page can list a detected game. That is when the endpoint returned an
 * extension for it, Vortex already knows the game because an extension is installed (the
 * endpoint returns no extension for the ones bundled with Vortex), or with the Tier 0
 * flag on, when the game may be managed without an extension.
 */
export function isListableDetectedGame(
  game: IDetectedGame,
  internalId: VortexGameId,
  knownGames: IGameStored[],
  options: IListableOptions = {},
): boolean {
  return (
    game.extension !== undefined ||
    knownGames.some((known) => known.id === internalId) ||
    (options.allowTierZero === true &&
      isTierZeroCandidate(game, options.extensionGameIds ?? new Set()))
  );
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
  options: IListableOptions = {},
): string[] {
  const ids: string[] = [];
  const listedIds = new Set<string>();

  for (const game of detected) {
    const domain = numericGameIdToDomainName(game.gameId);
    const internalId =
      domain === undefined ? undefined : detectedInternalId(knownGames, discovered, domain);
    if (isListableDetectedGame(game, internalId, knownGames, options)) {
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
