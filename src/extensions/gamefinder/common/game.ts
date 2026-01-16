import type { GameStore } from "./types";

/**
 * Represents a game found on the system
 */
export interface Game {
  /**
   * Unique identifier for the game within its store
   */
  id: string;

  /**
   * Display name of the game
   */
  name: string;

  /**
   * Absolute path to the game installation directory
   */
  path: string;

  /**
   * The store/platform where this game was found
   */
  store: GameStore;
}

/**
 * Creates a new Game object
 */
export function createGame(
  id: string,
  name: string,
  path: string,
  store: GameStore,
): Game {
  return { id, name, path, store };
}
