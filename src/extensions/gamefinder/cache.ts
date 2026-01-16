/**
 * GameFinder Cache
 *
 * Provides indexed lookup of detected games across all supported stores.
 * Game extensions can use this to find installation paths by store IDs.
 */

import type { IGameFinderIds } from "../../types/IGame";
import type { Game, GameStore, GameFinderError } from "./common";
import { SteamHandler } from "./store-handlers/steam";
import { GOGHandler } from "./store-handlers/gog";
import { EpicHandler } from "./store-handlers/epic";
import { XboxHandler } from "./store-handlers/xbox";
import type { StoreHandler } from "./common";

/**
 * Result from a GameFinder lookup
 */
export interface IGameFinderResult {
  /** Absolute path to the game installation */
  path: string;
  /** Which store the game was found in */
  store: GameStore;
  /** Full game information from the handler */
  game: Game;
}

/**
 * All available store handlers
 */
const ALL_HANDLERS: Record<GameStore, () => StoreHandler> = {
  steam: () => new SteamHandler(),
  gog: () => new GOGHandler(),
  epic: () => new EpicHandler(),
  xbox: () => new XboxHandler(),
};

/**
 * All supported stores
 */
const ALL_STORES: GameStore[] = ["steam", "gog", "epic", "xbox"];

/**
 * Cache for detected games, indexed by store and game ID
 */
export class GameFinderCache {
  /**
   * Games indexed by store and ID for fast lookup
   * Structure: { steam: { '1086940': Game, ... }, gog: { ... }, ... }
   */
  private cache: Map<GameStore, Map<string, Game>> = new Map();

  /**
   * All detected games by store (for getAllGames)
   */
  private gamesByStore: Map<GameStore, Game[]> = new Map();

  /**
   * Errors that occurred during detection
   */
  private errors: Map<GameStore, GameFinderError> = new Map();

  /**
   * Stores that were skipped (not available on this system)
   */
  private skipped: GameStore[] = [];

  /**
   * Whether the cache has been initialized
   */
  private initialized: boolean = false;

  /**
   * Initialize the cache by detecting games from all stores
   */
  async initialize(): Promise<void> {
    // Clear previous state
    this.cache.clear();
    this.gamesByStore.clear();
    this.errors.clear();
    this.skipped = [];

    // Initialize empty maps for each store
    for (const store of ALL_STORES) {
      this.cache.set(store, new Map());
      this.gamesByStore.set(store, []);
    }

    // Process stores in parallel
    const results = await Promise.all(
      ALL_STORES.map(async (store) => {
        const handler = ALL_HANDLERS[store]();

        // Check availability first
        const isAvailable = await handler.isAvailable();
        if (!isAvailable) {
          return { store, skipped: true };
        }

        // Find games
        const result = await handler.findAllGames();

        if (result.isErr()) {
          return { store, error: result.error };
        }

        return { store, games: result.value };
      }),
    );

    // Collect results
    for (const result of results) {
      if ("skipped" in result && result.skipped) {
        this.skipped.push(result.store);
      } else if ("error" in result && result.error) {
        this.errors.set(result.store, result.error);
      } else if ("games" in result && result.games) {
        // Store games by store
        this.gamesByStore.set(result.store, result.games);

        // Index games by ID for fast lookup
        const storeCache = this.cache.get(result.store)!;
        for (const game of result.games) {
          storeCache.set(game.id, game);
        }
      }
    }

    this.initialized = true;
  }

  /**
   * Find a game by its store IDs
   *
   * Checks each store specified in the IGameFinderIds and returns
   * the first match found. Checks stores in order: steam, gog, epic, xbox.
   *
   * @param ids Store IDs to look up
   * @returns The found game result, or undefined if not found
   */
  findByIds(ids: IGameFinderIds): IGameFinderResult | undefined {
    if (!this.initialized) {
      return undefined;
    }

    // Check each store in order
    const storeOrder: Array<{ store: GameStore; id: string | undefined }> = [
      { store: "steam", id: ids.steam },
      { store: "gog", id: ids.gog },
      { store: "epic", id: ids.epic },
      { store: "xbox", id: ids.xbox },
    ];

    for (const { store, id } of storeOrder) {
      if (id === undefined) {
        continue;
      }

      const storeCache = this.cache.get(store);
      if (storeCache === undefined) {
        continue;
      }

      const game = storeCache.get(id);
      if (game !== undefined) {
        return {
          path: game.path,
          store,
          game,
        };
      }
    }

    return undefined;
  }

  /**
   * Get all detected games grouped by store
   *
   * @returns Map of store name to array of games
   */
  getAllGames(): Map<GameStore, Game[]> {
    return this.gamesByStore;
  }

  /**
   * Get all games for a specific store
   *
   * @param store The store to get games for
   * @returns Array of games, or empty array if store not found
   */
  getGamesForStore(store: GameStore): Game[] {
    return this.gamesByStore.get(store) ?? [];
  }

  /**
   * Get errors that occurred during detection
   *
   * @returns Map of store name to error
   */
  getErrors(): Map<GameStore, GameFinderError> {
    return this.errors;
  }

  /**
   * Get stores that were skipped (not available on this system)
   *
   * @returns Array of skipped store names
   */
  getSkippedStores(): GameStore[] {
    return this.skipped;
  }

  /**
   * Check if the cache has been initialized
   *
   * @returns true if initialize() has been called
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the total number of detected games across all stores
   */
  getTotalGameCount(): number {
    let total = 0;
    for (const games of this.gamesByStore.values()) {
      total += games.length;
    }
    return total;
  }
}
