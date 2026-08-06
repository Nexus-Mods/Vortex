import update from "immutability-helper";

import type { IReducerSpec } from "../../../types/IExtensionContext";
import * as actions from "../actions/persistent";
import type { IValidateKeyDataV2 } from "../types/IValidateKeyData";

type PersistentState = {
  userInfo: IValidateKeyDataV2 | undefined;
  newestVersion: string | undefined;
  lastUpdate: undefined;
};

declare module "@/types/IState" {
  interface IState {
    persistent: {
      nexus: PersistentState;
    };
  }
}

/**
 * reducer for changes to the authentication
 */
export const persistentReducer: IReducerSpec = {
  reducers: {
    [actions.setUserInfo as any]: (state, payload) =>
      update(state, { userInfo: { $set: payload } }),
    [actions.setNewestVersion as any]: (state, payload) =>
      update(state, { newestVersion: { $set: payload } }),
  },
  defaults: {
    userInfo: undefined,
    newestVersion: undefined,
    lastUpdate: {},
  },
  verifiers: {
    userInfo: {
      description: () =>
        "Invalid Nexus user info will be removed, " + "this should resolve itself automatically.",
      type: "object",
      noNull: true,
    },
  },
};
