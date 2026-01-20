/**
 * Results API
 * Manages health check results and summaries
 */

import type { IHealthCheckResult } from "../../../types/IHealthCheck";
import type { HealthCheckRegistry } from "../core/HealthCheckRegistry";
import type { HealthCheckId } from "../types";

export interface IResultsApi {
  get: () => { [checkId in HealthCheckId]?: IHealthCheckResult };
  clear: () => void;
  getSummary: () => any;
}

export function createResultsApi(registry: HealthCheckRegistry): IResultsApi {
  return {
    /**
     * Get all health check results
     * @returns Map of checkId -> result
     */
    get: () => {
      return registry.getResults();
    },

    /**
     * Clear all cached results
     * Forces fresh execution on next check run
     */
    clear: () => {
      registry.clearResults();
    },

    /**
     * Get summary statistics of health check results
     * @returns Summary object with counts, statuses, etc.
     */
    getSummary: () => {
      return registry.getSummary();
    },
  };
}
