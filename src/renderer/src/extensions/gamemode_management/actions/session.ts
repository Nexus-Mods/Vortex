import { createAction } from "redux-act";

import type { IDetectedGame } from "../types/IDetectedGame";
import type { IGameStored } from "../types/IGameStored";

const identity = <T>(input: T): T => input;

/**
 * sets the list of known/supported games
 */
export const setKnownGames = createAction("SET_KNOWN_GAMES", identity<IGameStored[]>);

export const clearGameDisabled = createAction("CLEAR_GAME_DISABLED");

export const setGameDisabled = createAction(
  "SET_GAME_DISABLED",
  (gameId: string, disabledBy: string) => ({ gameId, disabledBy }),
);

export const setShowHiddenGames = createAction("SET_SHOW_HIDDEN_GAMES", identity<boolean>);

/**
 * sets the games detected on the user's machine that resolved to a Nexus Mods
 * game. Machine data, survives logout.
 */
export const setDetectedGames = createAction("SET_DETECTED_GAMES", identity<IDetectedGame[]>);

/**
 * sets the Nexus Mods game ids the user has favourited, as reported alongside
 * the detected games. User data, cleared on logout.
 */
export const setFavouriteGames = createAction("SET_FAVOURITE_GAMES", identity<number[]>);

export const clearFavouriteGames = createAction("CLEAR_FAVOURITE_GAMES");
