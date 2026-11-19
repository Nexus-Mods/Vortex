import type { IProfile } from "../../profile_management/types/IProfile";
import type { IGameStored } from "../types/IGameStored";

type GameWithId = Pick<IGameStored, "id">;

/**
 * Compares games so the most recently used comes first, for the "Recently used" sort.
 *
 * A profile has no timestamp until a switch to it completes, so a cancelled or failed
 * first switch leaves it unset. Those count as 0, which sorts the game last. Left as
 * undefined they'd make the comparison NaN, and a comparator that can't order one game
 * can misplace any of the others.
 */
export function byRecentlyUsed(profiles: { [profileId: string]: IProfile }) {
  const lastUsed = (game: GameWithId): number =>
    Math.max(
      0,
      ...Object.values(profiles)
        .filter((profile) => profile.gameId === game.id)
        .map((profile) => profile.lastActivated ?? 0),
    );

  return (lhs: GameWithId, rhs: GameWithId): number => lastUsed(rhs) - lastUsed(lhs);
}
