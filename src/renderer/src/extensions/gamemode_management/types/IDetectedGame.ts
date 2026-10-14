import type { IAvailableExtension } from "@/types/extensions";

/**
 * a Nexus Mods game matched to one or more of the store listings Vortex found
 * installed on the user's machine, as resolved by the detected-games endpoint
 */
export interface IDetectedGame {
  /** The game's id in the games catalogue/spine. */
  gameUid: string;
  /** The Nexus Mods game ID. */
  gameId: number;

  /** Cover art for the game, undefined when unavailable. */
  imageUrl?: string;

  /** The store listings that matched the game. */
  storeIDs: {
    steam: string[];
    gog: string[];
    epic: string[];
  };

  /** The Vortex game extension for the game, undefined when there is none. */
  extension?: IAvailableExtension;
}

/** How the detected-games request is going, for the section to show. */
export interface IDetectedGamesStatus {
  /** A request is in flight. */
  running: boolean;
  /** The last request failed, e.g. with no connection. */
  failed: boolean;
  /** A request has succeeded, so there are results to tell new games from. */
  hasResult: boolean;
}
