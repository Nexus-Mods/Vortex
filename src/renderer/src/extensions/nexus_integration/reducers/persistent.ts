import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/persistent";
import type { IValidateKeyDataV2 } from "../types/IValidateKeyData";

/** persistent.nexus: what Nexus Mods told us about the user and the latest Vortex release */
export interface INexusPersistentState {
  /** the signed-in user; undefined while logged out or not fetched yet */
  userInfo?: IValidateKeyDataV2;
  /** the newest Vortex version available on Nexus Mods */
  newestVersion?: string;
  // nothing writes or reads this; it has always been in the defaults, so persisted state has it
  lastUpdate: Record<string, never>;
}

declare module "@/types/IState" {
  interface IPersistentState {
    nexus: INexusPersistentState;
  }
}

/**
 * reducer for changes to the authentication
 */
export const persistentReducer = actionsToReducerSpec<INexusPersistentState, typeof actions>(
  {
    userInfo: undefined,
    newestVersion: undefined,
    lastUpdate: {},
  },
  actions,
  {
    // an unchanged value keeps the same state, as immutability-helper's $set did
    setUserInfo: (state, payload) =>
      "userInfo" in state && state.userInfo === payload ? state : { ...state, userInfo: payload },
    setNewestVersion: (state, payload) =>
      "newestVersion" in state && state.newestVersion === payload
        ? state
        : { ...state, newestVersion: payload },
  },
  {
    userInfo: {
      description: () =>
        "Invalid Nexus user info will be removed, " + "this should resolve itself automatically.",
      type: "object",
      noNull: true,
    },
  },
);
