import { getErrorCode, getErrorMessage } from "@vortex/shared";
import jwt from "jsonwebtoken";

import { log } from "@/logging";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { clearOAuthCredentials, setOAuthCredentials } from "../actions/account";
import { setUserInfo } from "../actions/persistent";
import { accessTokenSchema } from "../types/IJWTAccessToken";
import { requestTokenRefresh } from "./oauth";

/**
 * The one owner of the OAuth session. The credentials live in state; this module decides when
 * the access token is refreshed, runs one refresh at a time, and signs the user out when the
 * site refuses to renew. Both nexus-api (through its token provider) and the v3 client pull
 * their bearer token from here, so neither ever refreshes on its own.
 */

interface IOAuthCredentials {
  token: string;
  refreshToken: string;
  fingerprint: string;
}

// Refresh this far ahead of `exp` so a request made at the boundary doesn't pay a 401 round trip.
const REFRESH_LEEWAY_MS = 30 * 1000;

// A dead refresh token is turned down by the token endpoint with 400 invalid_grant (RFC 6749 §5.2).
const REFUSED_OAUTH_CODES = ["invalid_grant"];

let inFlight: Promise<string | undefined> | undefined;

function credentialsFromState(api: IExtensionApi): IOAuthCredentials | undefined {
  return api.getState().confidential.account?.["nexus"]?.["OAuthCredentials"];
}

function expiresSoon(token: string): boolean {
  const decoded: unknown = jwt.decode(token);
  const exp =
    typeof decoded === "object" && decoded !== null && typeof decoded["exp"] === "number"
      ? (decoded["exp"] as number)
      : undefined;
  // a token we can't read is left to the site to judge
  return exp !== undefined && exp * 1000 - Date.now() <= REFRESH_LEEWAY_MS;
}

/** The site turned the session down for good: drop it and ask the user to log in again. */
export function refuseLogin(api: IExtensionApi, err: unknown): void {
  if (credentialsFromState(api) === undefined) {
    return;
  }
  api.showErrorNotification("Authentication failed, please log in again", err, {
    allowReport: false,
  });
  api.store.dispatch(clearOAuthCredentials(null));
  api.store.dispatch(setUserInfo(undefined));
  api.events.emit("did-login", err);
}

async function doRefresh(
  api: IExtensionApi,
  current: IOAuthCredentials,
): Promise<string | undefined> {
  let reply;
  try {
    reply = await requestTokenRefresh(current.refreshToken);
  } catch (err) {
    if (REFUSED_OAUTH_CODES.includes(getErrorCode(err) ?? "")) {
      refuseLogin(api, err);
    }
    throw err;
  }

  // the session may have been replaced or ended while the request was out; don't resurrect it
  const latest = credentialsFromState(api);
  if (latest?.refreshToken !== current.refreshToken) {
    log("info", "OAuth session changed during a refresh, discarding the result");
    return latest?.token;
  }

  const parsed = accessTokenSchema.safeParse(jwt.decode(reply.access_token));
  api.store.dispatch(
    setOAuthCredentials(
      reply.access_token,
      reply.refresh_token,
      parsed.success ? parsed.data.fingerprint : current.fingerprint,
    ),
  );
  return reply.access_token;
}

/** One refresh at a time: everyone who needs a new token while one is on its way shares it. */
function refresh(api: IExtensionApi, current: IOAuthCredentials): Promise<string | undefined> {
  if (inFlight === undefined) {
    inFlight = doRefresh(api, current).finally(() => {
      inFlight = undefined;
    });
  }
  return inFlight;
}

/**
 * The access token to send, or undefined when not logged in through OAuth. Refreshes ahead of
 * expiry; a refresh that fails for a passing reason (offline, 5xx) hands back the current token
 * and lets the request find out. Pass the token a 401 came back for to force a refresh while it
 * is still the current one; a refused refresh then rejects, after signing the user out.
 */
export async function getAccessToken(
  api: IExtensionApi,
  rejectedToken?: string,
): Promise<string | undefined> {
  const current = credentialsFromState(api);
  if (current === undefined) {
    return undefined;
  }

  if (rejectedToken !== undefined) {
    return rejectedToken === current.token ? refresh(api, current) : current.token;
  }

  if (!expiresSoon(current.token)) {
    return current.token;
  }
  try {
    return await refresh(api, current);
  } catch (err) {
    log("info", "OAuth refresh failed, sending the current token", {
      message: getErrorMessage(err),
    });
    return current.token;
  }
}

/** `getAccessToken` bound to an api, in the shape nexus-api's `setTokenProvider` takes. */
export const tokenProviderFor =
  (api: IExtensionApi) =>
  (rejectedToken?: string): Promise<string | undefined> =>
    getAccessToken(api, rejectedToken);
