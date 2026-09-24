/**
 * Health Check API - Main Export
 * Combines all API modules into a single interface
 */

import type { IExtensionApi } from "@/types/IExtensionContext";
import { HealthCheckTrigger } from "@/types/IHealthCheck";
import type { IState } from "@/types/IState";

import type { HealthCheckRegistry } from "../core/HealthCheckRegistry";
import type { LegacyTestAdapter } from "../core/LegacyTestAdapter";
import { createHealthCheckTracker } from "../hooks/healthCheckTracker";
import type { IHealthCheckApi } from "../types";
import { countIssues, selectListedEntries, type IIssueCounts } from "../utils/shared/listedEntries";
import { createCustomCheckApi, type ICustomCheckApi } from "./customCheckApi";
import { createLegacyApi, type ILegacyApi } from "./legacyApi";
import { createResultsApi, type IResultsApi } from "./resultsApi";

/**
 * Counts for the issues the user actually sees — hidden entries excluded, so a fully
 * dismissed loadout reports the same "passed" the listing shows.
 */
const countActiveIssues = (state: IState): IIssueCounts =>
  countIssues(selectListedEntries(state).filter((item) => !item.hidden));

export function createHealthCheckApi(
  registry: HealthCheckRegistry,
  legacyAdapter: LegacyTestAdapter,
  api: IExtensionApi,
): IHealthCheckApi {
  // Create sub-APIs
  const customApi = createCustomCheckApi(registry, api);
  const legacyApi = createLegacyApi(legacyAdapter, registry);
  const resultsApi = createResultsApi(registry);
  const { trackScanTriggered } = createHealthCheckTracker(api);

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
    /**
     * Run the checks registered for a trigger, reporting the scan_triggered analytics
     * event. Every scan funnels through here — the refresh button, the automatic
     * triggers, and the settings/flag listeners — so this is the one place it can be
     * emitted without double counting.
     */
    runChecksByTrigger: async (trigger: HealthCheckTrigger) => {
      trackScanTriggered({
        is_manual: trigger === HealthCheckTrigger.Manual,
        previous_issue_count: countActiveIssues(api.getState()).total,
      });

      return registry.runChecksByTrigger(trigger, api);
    },
  };
}

// Re-export sub-interfaces for convenience
export type { ICustomCheckApi, ILegacyApi, IResultsApi };
