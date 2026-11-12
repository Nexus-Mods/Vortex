import type { VortexGameId } from "@vortex/shared";

import { actionsToReducerSpec } from "@/reducers/builder";
import type { IAvailableExtension } from "@/types/extensions";

import * as actions from "../actions/session";
import type { GameSource } from "../types/GameSource";
import type { DetectedGamesStatus, IDetectedGame } from "../types/IDetectedGame";
import type { IGameStored } from "../types/IGameStored";

type DefaultState = {
  known: IGameStored[];
  disabled: Record<string, string>;
  showHidden: boolean;
  detectedGames: IDetectedGame[];
  /** Unset before any request, or once there's nothing to say about the last one. */
  detectedGamesStatus?: DetectedGamesStatus;
  favouriteGames: number[];
  gameAddOrigin: { gameId: string; source: GameSource } | null;
  /**
   * The store the user picked the game from while adding it. Unlike `gameAddOrigin` it's
   * cleared when the add ends, because discovery acts on it.
   */
  gameAddStore: { gameId: VortexGameId; store: string } | null;
  /**
   * The extension of the tile the user is adding a game from, for a game nothing is registered
   * for. Cleared with `gameAddStore`, when the add ends.
   */
  gameAddExtension: IAvailableExtension | null;
};

declare module "@/types/IState" {
  interface ISessionState {
    gameMode: DefaultState;
  }
}

const defaultState: DefaultState = {
  known: [],
  disabled: {},
  showHidden: false,
  detectedGames: [],
  favouriteGames: [],
  gameAddOrigin: null,
  gameAddStore: null,
  gameAddExtension: null,
};

export const sessionReducer = actionsToReducerSpec(defaultState, actions, {
  setKnownGames: (state, payload) => ({
    ...state,
    known: payload,
  }),
  setGameDisabled: (state, payload) => ({
    ...state,
    disabled: {
      ...state.disabled,
      [payload.gameId]: payload.disabledBy,
    },
  }),
  clearGameDisabled: (state) => ({
    ...state,
    disabled: {},
  }),
  setShowHiddenGames: (state, payload) => ({
    ...state,
    showHidden: payload,
  }),
  setDetectedGames: (state, payload) => ({
    ...state,
    detectedGames: payload,
  }),
  setDetectedGamesStatus: (state, payload) => ({
    ...state,
    detectedGamesStatus: payload,
  }),
  setFavouriteGames: (state, payload) => ({
    ...state,
    favouriteGames: payload,
  }),
  clearFavouriteGames: (state) => ({
    ...state,
    favouriteGames: [],
  }),
  setGameAddOrigin: (state, payload) => ({
    ...state,
    gameAddOrigin: payload,
  }),
  setGameAddStore: (state, payload) => ({
    ...state,
    gameAddStore: payload,
  }),
  setGameAddExtension: (state, payload) => ({
    ...state,
    gameAddExtension: payload.extension,
  }),
  clearGameAddStore: (state) => ({
    ...state,
    gameAddStore: null,
    gameAddExtension: null,
  }),
});
