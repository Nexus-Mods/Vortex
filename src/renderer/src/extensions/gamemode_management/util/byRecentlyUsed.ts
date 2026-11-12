import type { IProfile } from "../../profile_management/types/IProfile";
import type { IGameStored } from "../types/IGameStored";

/**
 * When any of the game's profiles was last activated, or 0 if never. A new game's first
 * profile has no lastActivated until it's switched to, and an unmanaged game has no profiles,
 * so both default to 0 rather than NaN or -Infinity, which would break the sort.
 */
export function lastUsed(profiles: { [profileId: string]: IProfile }, gameId: string): number {
  return Math.max(
    0,
    ...Object.values(profiles)
      .filter((prof) => prof.gameId === gameId)
      .map((prof) => prof.lastActivated ?? 0),
  );
}

/** Sort comparator putting the most recently activated game first. */
export function byRecentlyUsed(profiles: {
  [profileId: string]: IProfile;
}): (lhs: IGameStored, rhs: IGameStored) => number {
  return (lhs, rhs) => lastUsed(profiles, rhs.id) - lastUsed(profiles, lhs.id);
}
