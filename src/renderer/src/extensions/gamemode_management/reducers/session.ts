import { actionsToReducerSpec } from "@/reducers/builder";

import * as actions from "../actions/session";
import type { IGameStored } from "../types/IGameStored";

type DefaultState = {
  known: IGameStored[];
  disabled: Record<string, string>;
  showHidden: boolean;
};

const defaultState: DefaultState = {
  known: [],
  disabled: {},
  showHidden: false,
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
});
