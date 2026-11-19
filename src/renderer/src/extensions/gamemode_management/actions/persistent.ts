import type { NexusGameDomain, NexusGameId } from "@vortex/shared";
import { createAction } from "redux-act";

import type {
  IGameUidRetirement,
  IManualInstallerPreferences,
  ITierZeroGame,
} from "@/types/IState";

/**
 * append uid retirements to the history, in order. The only write to the history: entries are
 * never edited or removed, a wrong mapping is fixed by appending a correction. Invalid entries
 * (not lowercase uids, or mapping a uid to itself) are dropped with a logged error.
 */
export const appendGameUidRetirements = createAction(
  "APPEND_GAME_UID_RETIREMENTS",
  (entries: IGameUidRetirement[]) => ({ entries }),
);

export const setGameInfo = createAction(
  "SET_GAME_INFO",
  (
    gameId: string,
    provider: string,
    priority: number,
    expires: number,
    values: Array<{ key: string; title: string; value: any }>,
  ) => ({ gameId, provider, priority, expires, values }),
);

/**
 * record a game as managed without a game extension, keyed by numeric nexus game id
 */
export const setTierZeroGame = createAction(
  "SET_TIER_ZERO_GAME",
  (gameId: NexusGameId, entry: ITierZeroGame) => ({ gameId, entry }),
);

/**
 * set the user's Manual Installer preferences for a Tier 0 game
 */
export const setManualInstallerPreferences = createAction(
  "SET_MANUAL_INSTALLER_PREFERENCES",
  (gameId: NexusGameId, preferences: IManualInstallerPreferences) => ({ gameId, preferences }),
);

/**
 * forget a Tier 0 game (un-manage or extension takeover)
 */
export const removeTierZeroGame = createAction("REMOVE_TIER_ZERO_GAME", (gameId: NexusGameId) => ({
  gameId,
}));
