/**
 * GameFinder Extension
 *
 * Provides automatic game detection across multiple store fronts (Steam, GOG, Epic, Xbox).
 * Game extensions opt-in by specifying store IDs in their registration.
 */

import type { IExtensionContext } from "../../types/IExtensionContext";
import { log } from "../../util/log";
import { GameFinderCache } from "./cache";

// Export the cache class for external access
export { GameFinderCache };

// Export types
export * from "./types";

// Singleton cache instance
let gameFinderCache: GameFinderCache | null = null;

/**
 * Get the GameFinder cache instance
 * Returns null if the extension hasn't been initialized yet
 */
export function getGameFinderCache(): GameFinderCache | null {
  return gameFinderCache;
}

function init(context: IExtensionContext): boolean {
  // Initialize cache at startup
  context.once(() => {
    log("info", "GameFinder: Initializing game detection");
    gameFinderCache = new GameFinderCache();

    gameFinderCache
      .initialize()
      .then(() => {
        const allGames = gameFinderCache!.getAllGames();
        let totalGames = 0;
        for (const [store, games] of allGames) {
          log("info", `GameFinder: Found ${games.length} games from ${store}`);
          totalGames += games.length;
        }
        log(
          "info",
          `GameFinder: Detection complete. Found ${totalGames} games total.`,
        );
      })
      .catch((err) => {
        log("error", "GameFinder: Failed to initialize", err);
      });
  });

  return true;
}

export default init;
