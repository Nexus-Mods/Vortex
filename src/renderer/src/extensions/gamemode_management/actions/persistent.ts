import type { GameDomain, GameId } from "@vortex/shared";
import { createAction } from "redux-act";

import type { ITierZeroGame } from "@/types/IState";

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
 * forget a Tier 0 game (un-manage or extension takeover)
 */
export const removeTierZeroGame = createAction("REMOVE_TIER_ZERO_GAME", (gameId: GameId) => ({
  gameId,
}));
