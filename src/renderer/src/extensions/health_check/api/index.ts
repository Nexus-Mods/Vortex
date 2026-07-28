/**
 * Health Check API - Main Export
 * Combines all API modules into a single interface
 */

import type { IExtensionApi } from "@/types/IExtensionContext";
import { HealthCheckTrigger } from "@/types/IHealthCheck";

import type { HealthCheckRegistry } from "../core/HealthCheckRegistry";
import type { LegacyTestAdapter } from "../core/LegacyTestAdapter";
import { createHealthCheckTracker } from "../hooks/useHealthCheckTracking";
import type { IHealthCheckApi } from "../types";
import { countActiveIssues } from "../utils/shared/listedEntries";
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
  const { trackScanCompleted, trackScanTriggered } = createHealthCheckTracker(api);

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
     * Run the checks registered for a trigger, bracketed by the scan_triggered /
     * scan_completed analytics events. Every scan funnels through here —
     * the refresh button, the automatic triggers, and the settings/flag listeners —
     * so this is the one place the pair can be emitted without double counting.
     * A run that throws deliberately leaves no scan_completed behind.
     */
    runChecksByTrigger: async (trigger: HealthCheckTrigger) => {
      trackScanTriggered({
        is_manual: trigger === HealthCheckTrigger.Manual,
        previous_issue_count: countActiveIssues(api.getState()).total,
      });

      const startedAt = Date.now();
      const results = await registry.runChecksByTrigger(trigger, api);
      const counts = countActiveIssues(api.getState());

      trackScanCompleted({
        duration_ms: Date.now() - startedAt,
        total_issues_found: counts.total,
        warning_count: counts.warning,
        suggestion_count: counts.suggestion,
        health_check_passed: counts.total === 0,
      });

      return results;
    },
  };
}

// Re-export sub-interfaces for convenience
export type { ICustomCheckApi, ILegacyApi, IResultsApi };
