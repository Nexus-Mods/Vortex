import { actionsToReducerSpec, setField } from "../../../reducers/builder";
import * as actions from "../actions/account";

/** The OAuth session's credentials, as setOAuthCredentials stores them. */
export interface INexusOAuthCredentials {
  token: string;
  refreshToken: string;
  fingerprint: string;
}

/** confidential.account.nexus: how the user is signed in to Nexus Mods */
export interface INexusAccountState {
  /** legacy API key login */
  APIKey?: string;
  OAuthCredentials?: INexusOAuthCredentials;
  /** set when a logout was forced, normally via a migration */
  ForcedLogout: boolean;
}

declare module "@/types/IState" {
  interface IConfidentialAccount {
    nexus: INexusAccountState;
  }
}

/**
 * reducer for changes to the authentication
 */
export const accountReducer = actionsToReducerSpec<INexusAccountState, typeof actions>(
  {
    APIKey: undefined,
    OAuthCredentials: undefined,
    ForcedLogout: false,
  },
  actions,
  {
    setUserAPIKey: (state, payload) => setField(state, "APIKey", payload),
    clearOAuthCredentials: (state) => ({ ...state, OAuthCredentials: undefined }),
    setOAuthCredentials: (state, payload) => ({ ...state, OAuthCredentials: { ...payload } }),
    setForcedLogout: (state, payload) => ({ ...state, ForcedLogout: payload }),
  },
);
