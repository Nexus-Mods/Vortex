import { createAction } from "redux-act";

/*
 * action to set the user API Key. Takes one parameter, the api key as a string
 */
export const setUserAPIKey = createAction("SET_USER_API_KEY", (key: string) => key);

export const clearOAuthCredentials = createAction("CLEAR_OAUTH_CREDENTIALS", () => null);

export const setOAuthCredentials = createAction(
  "SET_OAUTH_CREDENTIALS",
  (token: string, refreshToken: string, fingerprint: string) => ({
    token,
    refreshToken,
    fingerprint,
  }),
);

/*
 * set to true if a logout was forced, normally via a migration
 */
export const setForcedLogout = createAction("SET_FORCED_LOGOUT", (value: boolean) => value);
