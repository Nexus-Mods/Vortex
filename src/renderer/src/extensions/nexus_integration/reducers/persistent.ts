import { actionsToReducerSpec, setField } from "../../../reducers/builder";
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
    setUserInfo: (state, payload) => setField(state, "userInfo", payload),
    setNewestVersion: (state, payload) => setField(state, "newestVersion", payload),
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
