import type { IUpdateEntry } from "@nexusmods/nexus-api";
import type { VortexGameId } from "@vortex/shared";

import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/session";

/** The last check for recently updated mods of one game. */
export interface INexusLastUpdateCheck {
  time: number;
  range: number;
  updateList: IUpdateEntry[];
}

/** session.nexus: the login in progress, update checks and the free user download queue */
export interface INexusSessionState {
  /** id of the login in progress; "__failed" after a failed legacy login */
  loginId?: string;
  loginError?: string;
  /** keyed by the game the check was made for */
  lastUpdate: Record<VortexGameId, INexusLastUpdateCheck>;
  /** nxm urls waiting for a free user to start them */
  freeUserDLQueue: string[];
  /** the url of the OAuth login in progress */
  oauthPending?: string;
}

declare module "@/types/IState" {
  interface ISessionState {
    nexus: INexusSessionState;
  }
}

// setSafe/addUniqueSafe/removeValue replaced a missing or non-array queue with an empty one
function queueOf(state: INexusSessionState): string[] {
  return Array.isArray(state.freeUserDLQueue) ? state.freeUserDLQueue : [];
}

/**
 * reducer for changes to the authentication
 */
export const sessionReducer = actionsToReducerSpec<INexusSessionState, typeof actions>(
  {
    loginId: undefined,
    loginError: undefined,
    lastUpdate: {},
    freeUserDLQueue: [],
  },
  actions,
  {
    setLoginId: (state, payload) =>
      // also reset login errors when login gets closed
      payload === undefined
        ? { ...state, loginError: undefined, loginId: payload }
        : { ...state, loginId: payload },
    setLoginError: (state, payload) => ({ ...state, loginError: payload }),
    setLastUpdateCheck: (state, payload) => ({
      ...state,
      lastUpdate: {
        ...state.lastUpdate,
        [payload.gameId]: {
          time: payload.time,
          updateList: payload.updateList,
          range: payload.range,
        },
      },
    }),
    addFreeUserDLItem: (state, payload) => {
      const queue = queueOf(state);
      return queue.indexOf(payload) !== -1
        ? state
        : { ...state, freeUserDLQueue: [...queue, payload] };
    },
    removeFreeUserDLItem: (state, payload) => {
      const queue = queueOf(state);
      const index = queue.indexOf(payload);
      return index === -1 ? state : { ...state, freeUserDLQueue: queue.toSpliced(index, 1) };
    },
    setOauthPending: (state, payload) => ({ ...state, oauthPending: payload }),
  },
);
