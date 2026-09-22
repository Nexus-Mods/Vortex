import {
  createNexusV3Client,
  createNexusV3InternalClient,
  type NexusV3Client,
  type NexusV3ClientOptions,
  type NexusV3InternalClient,
  type NexusV3Middleware,
} from "@vortex/nexus-api-v3";

import type { IExtensionApi } from "../../types/IExtensionContext";
import { getApplication } from "../../util/application";
import { NEXUS_API_URL } from "./constants";
import { hasConfidentialWithNexus } from "./guards";
import { getOAuthTokenFromState } from "./util";
import { getAccessToken } from "./util/oauthSession";

export type VortexNexusV3ClientOptions = Omit<NexusV3ClientOptions, "baseUrl" | "userAgent">;

const NEXUS_V3_API_URL = `${NEXUS_API_URL}/v3`;

/**
 * Bearer auth that outlives the token the client was built with: the session refreshes the OAuth
 * token ahead of expiry, so resolve it per request rather than once at creation, and retry a 401
 * once with a forced refresh, as nexus-api does for its own requests.
 */
function oauthMiddleware(api: IExtensionApi): NexusV3Middleware {
  // The first fetch consumes the body, so a retry needs a clone taken beforehand.
  const inflight = new Map<string, { retry: Request; token: string | undefined }>();

  const getToken = (rejectedToken?: string) => getAccessToken(api, rejectedToken);

  return {
    async onRequest({ id, request }) {
      const token = await getToken();
      if (token !== undefined) {
        request.headers.set("Authorization", `Bearer ${token}`);
      }
      inflight.set(id, { retry: request.clone(), token });
    },
    async onResponse({ id, response, options }) {
      const sent = inflight.get(id);
      inflight.delete(id);
      if (response.status !== 401 || sent?.token === undefined) {
        return undefined;
      }
      let fresh: string | undefined;
      try {
        fresh = await getToken(sent.token);
      } catch {
        // the refresh was refused, so the 401 stands and the caller decides
        return undefined;
      }
      if (fresh === undefined || fresh === sent.token) {
        return undefined;
      }
      sent.retry.headers.set("Authorization", `Bearer ${fresh}`);
      return options.fetch(sent.retry);
    },
    onError({ id }) {
      inflight.delete(id);
    },
  };
}

/** Resolve Vortex's credentials, base URL and user agent into client options. */
function vortexV3Options(
  api: IExtensionApi,
  options: VortexNexusV3ClientOptions,
): NexusV3ClientOptions {
  const { confidential } = api.getState();
  const apiKey = hasConfidentialWithNexus(confidential)
    ? confidential.account.nexus?.APIKey
    : undefined;

  return {
    bearerToken: getOAuthTokenFromState(api),
    apiKey,
    ...options,
    middleware: [oauthMiddleware(api), ...(options.middleware ?? [])],
    baseUrl: NEXUS_V3_API_URL,
    userAgent: `Vortex/${getApplication().version}`,
  };
}

/**
 * Creates a Nexus v3 API client pre-configured for Vortex.
 * Credentials can still be overridden via `options`.
 */
export function createVortexNexusV3Client(
  api: IExtensionApi,
  options: VortexNexusV3ClientOptions = {},
): NexusV3Client {
  return createNexusV3Client(vortexV3Options(api, options));
}

/** As `createVortexNexusV3Client`, for the Internal v3 endpoints (telemetry ingest). */
export function createVortexNexusV3InternalClient(
  api: IExtensionApi,
  options: VortexNexusV3ClientOptions = {},
): NexusV3InternalClient {
  return createNexusV3InternalClient(vortexV3Options(api, options));
}
