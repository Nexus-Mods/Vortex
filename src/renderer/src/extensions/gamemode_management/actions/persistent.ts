import type { GameDomain, GameId } from "@vortex/shared";
import { createAction } from "redux-act";

import type { IManualInstallerPreferences, ITierZeroGame } from "@/types/IState";

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
  (gameId: GameId, entry: ITierZeroGame) => ({ gameId, entry }),
);

/**
 * set the user's Manual Installer preferences for a Tier 0 game
 */
export const setManualInstallerPreferences = createAction(
  "SET_MANUAL_INSTALLER_PREFERENCES",
  (gameId: GameId, preferences: IManualInstallerPreferences) => ({ gameId, preferences }),
);

/**
 * forget a Tier 0 game (un-manage or extension takeover)
 */
export const removeTierZeroGame = createAction("REMOVE_TIER_ZERO_GAME", (gameId: GameId) => ({
  gameId,
}));
