import type { IDetectedGame } from "../../types/IDetectedGame";

/**
 * Steam, then Epic, then GOG: the order findByAppId walks the stores in, and most game
 * extensions discover through it. A game on several stores is labelled with the one
 * discovery most likely picks, so the label usually stays put once the game's added.
 */
const STORE_ORDER = ["steam", "epic", "gog"] as const;

/**
 * The store a detected game's tile names until discovery records one of its own: one the
 * detected-games response matched an installed listing on, or undefined if none matched.
 */
export function detectedStore(game: IDetectedGame): string | undefined {
  return STORE_ORDER.find((store) => game.storeIDs[store].length > 0);
}
