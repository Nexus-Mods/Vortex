/**
 * Legacy Test API
 * Adapter for converting old Vortex tests to health checks
 */

import type { CheckFunction } from "../../../renderer/types/IExtensionContext";
import type { HealthCheckCategory } from "../../../renderer/types/IHealthCheck";
import type { LegacyTestAdapter } from "../core/LegacyTestAdapter";
import type { HealthCheckRegistry } from "../core/HealthCheckRegistry";

export interface ILegacyApi {
  registerTest: (
    id: string,
    eventType: string,
    check: CheckFunction,
    category?: HealthCheckCategory,
  ) => void;
}

export function createLegacyApi(
  adapter: LegacyTestAdapter,
  registry: HealthCheckRegistry,
): ILegacyApi {
  return {
    /**
     * Register a legacy test and convert it to a health check
     * @param id - Test ID
     * @param eventType - Event that triggers the test
     * @param check - Check function (legacy format)
     * @param category - Optional category classification
     */
    registerTest: (
      id: string,
      eventType: string,
      check: CheckFunction,
      category?: HealthCheckCategory,
    ) => {
      const legacyCheck = adapter.createLegacyHealthCheck(
        id,
        eventType,
        check,
        category,
      );
      registry.register(legacyCheck);
    },
  };
}
