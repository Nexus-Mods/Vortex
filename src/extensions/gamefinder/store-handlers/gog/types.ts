/**
 * GOG-specific types and data structures
 */

import type { Game } from "../../common";

/**
 * GOG Game ID - unique identifier for a game on GOG
 */
export type GOGGameId = bigint;

/**
 * GOG Build ID - identifies a specific build/version
 */
export type GOGBuildId = bigint;

/**
 * Represents a game found via GOG Galaxy
 */
export interface GOGGame extends Game {
  store: "gog";

  /**
   * GOG-specific game ID
   */
  gogId: GOGGameId;

  /**
   * Build/version identifier
   */
  buildId: GOGBuildId;

  /**
   * Parent game ID for DLC (undefined if this is a base game)
   */
  parentGameId?: GOGGameId | undefined;

  /**
   * Whether this is a DLC
   */
  isDlc: boolean;
}

/**
 * Creates a GOGGame from its components
 */
export function createGOGGame(
  gogId: GOGGameId,
  name: string,
  path: string,
  buildId: GOGBuildId,
  parentGameId?: GOGGameId,
): GOGGame {
  return {
    id: gogId.toString(),
    name,
    path,
    store: "gog",
    gogId,
    buildId,
    parentGameId,
    isDlc: parentGameId !== undefined,
  };
}
