import type { IUpdateEntry } from "@nexusmods/nexus-api";

import { actionsToReducerSpec } from "@/reducers/builder";

import * as actions from "../actions/session";

type SessionState = {
  freeUserDLQueue: string[];
  lastUpdate: Record<string, { time: number; range: number; updateList: IUpdateEntry[] }>;
  loginError: string | undefined;
  loginId: string | undefined;
  oauthPending: string | undefined;
};

declare module "@/types/IState" {
  interface ISession {
    nexus: SessionState;
  }
}

const defaultState: SessionState = {
  loginId: undefined,
  loginError: undefined,
  lastUpdate: {},
  freeUserDLQueue: [],
  oauthPending: undefined,
};

export const sessionReducer = actionsToReducerSpec(defaultState, actions, {
  addFreeUserDLItem: (state, payload) => {
    const arr = state.freeUserDLQueue;
    return { ...state, freeUserDLQueue: arr.includes(payload) ? arr : [...arr, payload] };
  },
  removeFreeUserDLItem: (state, payload) => {
    const arr = state.freeUserDLQueue;
    return { ...state, freeUserDLQueue: arr.toSpliced(arr.indexOf(payload), 1) };
  },
  setLastUpdateCheck: (state, payload) => ({
    ...state,
    [payload.gameId]: { time: payload.time, updateList: payload.updateList, range: payload.range },
  }),
  setLoginError: (state, payload) => ({ ...state, loginError: payload }),
  setLoginId: (state, payload) => {
    if (payload === undefined) {
      return { ...state, loginError: undefined, loginId: undefined };
    }

    return { ...state, loginId: payload };
  },
  setOauthPending: (state, payload) => ({ ...state, oauthPending: payload }),
});
