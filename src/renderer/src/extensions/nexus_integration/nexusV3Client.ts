import {
  createNexusV3Client,
  type NexusV3Client,
  type NexusV3ClientOptions,
} from "@vortex/nexus-api-v3";

import type { IExtensionApi } from "../../types/IExtensionContext";
import { getApplication } from "../../util/application";
import { NEXUS_API_URL } from "./constants";
import { hasConfidentialWithNexus } from "./guards";
import { getOAuthTokenFromState } from "./util";

export type VortexNexusV3ClientOptions = Omit<NexusV3ClientOptions, "baseUrl" | "userAgent">;

/**
 * Creates a Nexus v3 API client pre-configured for Vortex.
 * Credentials can still be overridden via `options`.
 */
export function createVortexNexusV3Client(
  api: IExtensionApi,
  options: VortexNexusV3ClientOptions = {},
): NexusV3Client {
  const { confidential } = api.getState();
  const apiKey = hasConfidentialWithNexus(confidential)
    ? confidential.account.nexus?.APIKey
    : undefined;

  return createNexusV3Client({
    bearerToken: getOAuthTokenFromState(api),
    apiKey,
    ...options,
    baseUrl: NEXUS_API_URL,
    userAgent: `Vortex/${getApplication().version}`,
  });
}
