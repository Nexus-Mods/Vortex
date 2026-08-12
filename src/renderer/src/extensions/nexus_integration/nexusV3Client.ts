import {
  createNexusV3Client,
  createNexusV3InternalClient,
  type NexusV3Client,
  type NexusV3ClientOptions,
  type NexusV3InternalClient,
} from "@vortex/nexus-api-v3";

import type { IExtensionApi } from "../../types/IExtensionContext";
import { getApplication } from "../../util/application";
import { NEXUS_API_URL } from "./constants";
import { hasConfidentialWithNexus } from "./guards";
import { getOAuthTokenFromState } from "./util";

export type VortexNexusV3ClientOptions = Omit<NexusV3ClientOptions, "baseUrl" | "userAgent">;

const NEXUS_V3_API_URL = `${NEXUS_API_URL}/v3`;

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
