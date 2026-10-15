import { createAction } from "redux-act";

import type { GameSource } from "../types/GameSource";
import type { DetectedGamesStatus, IDetectedGame } from "../types/IDetectedGame";
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
 * records how the last detected-games request went: running, failed or succeeded;
 * undefined when there's nothing to say, as before any request or after logging out
 */
export const setDetectedGamesStatus = createAction(
  "SET_DETECTED_GAMES_STATUS",
  identity<DetectedGamesStatus | undefined>,
);

/**
 * sets the Nexus Mods game ids the user has favourited, as reported alongside
 * the detected games. User data, cleared on logout.
 */
export const setFavouriteGames = createAction("SET_FAVOURITE_GAMES", identity<number[]>);

export const clearFavouriteGames = createAction("CLEAR_FAVOURITE_GAMES");

/**
 * records which Games page list the user is adding a game from, so the
 * app_game_manage event can carry the origin when the add completes
 */
export const setGameAddOrigin = createAction(
  "SET_GAME_ADD_ORIGIN",
  (gameId: string, source: GameSource) => ({ gameId, source }),
);
