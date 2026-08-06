import { actionsToReducerSpec } from "@/reducers/builder";

import * as actions from "../actions/account";

type AccountState = {
  APIKey: string | undefined;
  OAuthCredentials: { token: string; refreshToken: string; fingerprint: string } | undefined;
  ForcedLogout: boolean;
};

const defaultState: AccountState = {
  APIKey: undefined,
  OAuthCredentials: undefined,
  ForcedLogout: false,
};

declare module "@/types/IState" {
  interface IConfidentialAccountState {
    nexus: AccountState;
  }
}

export const accountReducer = actionsToReducerSpec(defaultState, actions, {
  setUserAPIKey: (state, payload) => ({ ...state, APIKey: payload }),
  clearOAuthCredentials: (state) => ({ ...state, OAuthCredentials: undefined }),
  setOAuthCredentials: (state, payload) => ({ ...state, OAuthCredentials: payload }),
  setForcedLogout: (state, payload) => ({ ...state, ForcedLogout: payload }),
});
