import { actionsToReducerSpec } from "@/reducers/builder";

import * as actions from "../actions/session";
import type { GameSource } from "../types/GameSource";
import type { IDetectedGame } from "../types/IDetectedGame";
import type { IGameStored } from "../types/IGameStored";

type DefaultState = {
  known: IGameStored[];
  disabled: Record<string, string>;
  showHidden: boolean;
  detectedGames: IDetectedGame[];
  favouriteGames: number[];
  gameAddOrigin: { gameId: string; source: GameSource } | null;
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
});
