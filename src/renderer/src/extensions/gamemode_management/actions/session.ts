import { createAction } from "redux-act";

import type { IGameStored } from "../types/IGameStored";
/**
 * sets the list of known/supported games
 */
export const setKnownGames = createAction("SET_KNOWN_GAMES", (games: IGameStored[]) => games);

export const clearGameDisabled = createAction("CLEAR_GAME_DISABLED");

export const setGameDisabled = createAction(
  "SET_GAME_DISABLED",
  (gameId: string, disabledBy: string) => ({ gameId, disabledBy }),
);

export const setShowHiddenGames = createAction("SET_SHOW_HIDDEN_GAMES", (show: boolean) => show);
