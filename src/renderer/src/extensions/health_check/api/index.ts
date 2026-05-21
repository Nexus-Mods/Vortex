/**
 * Health Check API - Main Export
 * Combines all API modules into a single interface
 */

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { HealthCheckTrigger } from "../../../types/IHealthCheck";
import type { HealthCheckRegistry } from "../core/HealthCheckRegistry";
import type { LegacyTestAdapter } from "../core/LegacyTestAdapter";
import type { IHealthCheckApi } from "../types";
import { createCustomCheckApi, type ICustomCheckApi } from "./customCheckApi";
import { createLegacyApi, type ILegacyApi } from "./legacyApi";
import { createResultsApi, type IResultsApi } from "./resultsApi";

export function createHealthCheckApi(
  registry: HealthCheckRegistry,
  legacyAdapter: LegacyTestAdapter,
  api: IExtensionApi,
): IHealthCheckApi {
  // Create sub-APIs
  const customApi = createCustomCheckApi(registry, api);
  const legacyApi = createLegacyApi(legacyAdapter, registry);
  const resultsApi = createResultsApi(registry);

  return {
    custom: customApi,
    legacy: legacyApi,
    results: resultsApi,

    /**
     * Run all health checks
     * @returns Combined results from all checks
     */
    runAll: async () => {
      return registry.runAllHealthChecks(api);
    },
    runChecksByTrigger: async (trigger: HealthCheckTrigger) => {
      return registry.runChecksByTrigger(trigger, api);
    },
  };
}

// Re-export sub-interfaces for convenience
export type { ICustomCheckApi, ILegacyApi, IResultsApi };
