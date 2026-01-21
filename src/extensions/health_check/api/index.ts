/**
 * Health Check API - Main Export
 * Combines all API modules into a single interface
 */

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type {
  HealthCheckTrigger,
  IHealthCheckResult,
} from "../../../types/IHealthCheck";
import type { HealthCheckRegistry } from "../core/HealthCheckRegistry";
import type { LegacyTestAdapter } from "../core/LegacyTestAdapter";
import type { PredefinedCheckId, IHealthCheckApi } from "../types";
import { createCustomCheckApi, type ICustomCheckApi } from "./customCheckApi";
import {
  createPredefinedCheckApi,
  type IPredefinedCheckApi,
} from "./predefinedCheckApi";
import { createLegacyApi, type ILegacyApi } from "./legacyApi";
import { createResultsApi, type IResultsApi } from "./resultsApi";
import { unknownToError } from "../../../shared/errors";

export function createHealthCheckApi(
  registry: HealthCheckRegistry,
  legacyAdapter: LegacyTestAdapter,
  api: IExtensionApi,
): IHealthCheckApi {
  // Create sub-APIs
  const customApi = createCustomCheckApi(registry, api);
  const predefinedApi = createPredefinedCheckApi();
  const legacyApi = createLegacyApi(legacyAdapter, registry);
  const resultsApi = createResultsApi(registry);

  return {
    custom: customApi,
    predefined: predefinedApi,
    legacy: legacyApi,
    results: resultsApi,

    /**
     * Run all health checks (both custom and predefined)
     * @returns Combined results from renderer and main process checks
     */
    runAll: async () => {
      // Run local custom checks
      const localResults = await registry.runAllHealthChecks(api);

      // Also run all predefined checks
      try {
        const predefinedCheckIds: PredefinedCheckId[] =
          await predefinedApi.list();
        const predefinedResults = await Promise.all(
          predefinedCheckIds.map((id: PredefinedCheckId) =>
            predefinedApi.run(id),
          ),
        );

        // Combine results (filter out nulls from failed predefined checks)
        return [
          ...localResults,
          ...predefinedResults.filter((r) => r !== null),
        ] as IHealthCheckResult[];
      } catch (error) {
        // If main process checks fail, just return local results
        console.error("Failed to run predefined checks:", unknownToError(error));
        return localResults;
      }
    },
    runChecksByTrigger: async (trigger: HealthCheckTrigger) => {
      return registry.runChecksByTrigger(trigger, api);
    },
  };
}

// Re-export sub-interfaces for convenience
export type { ICustomCheckApi, IPredefinedCheckApi, ILegacyApi, IResultsApi };
