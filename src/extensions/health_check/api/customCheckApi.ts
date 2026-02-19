/**
 * Custom Health Check API - Renderer Process
 * Manages custom health checks registered by extensions
 */

import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";
import type {
  IHealthCheck,
  IHealthCheckResult,
  HealthCheckTrigger,
  IHealthCheckEntry,
} from "../../../renderer/types/IHealthCheck";
import type { HealthCheckRegistry } from "../core/HealthCheckRegistry";
import type { HealthCheckId } from "../types";

export interface ICustomCheckApi {
  register: (healthCheck: IHealthCheck) => void;
  unregister: (checkId: HealthCheckId) => void;
  run: (
    checkId: HealthCheckId,
    force?: boolean,
  ) => Promise<IHealthCheckResult | undefined>;
  runByTrigger: (trigger: HealthCheckTrigger) => Promise<IHealthCheckResult[]>;
  getAll: () => IHealthCheckEntry[];
}

export function createCustomCheckApi(
  registry: HealthCheckRegistry,
  api: IExtensionApi,
): ICustomCheckApi {
  return {
    /**
     * Register a custom health check
     * The check function runs in the renderer process
     */
    register: (healthCheck: IHealthCheck) => {
      registry.register(healthCheck);
    },

    /**
     * Unregister a custom health check
     */
    unregister: (checkId: HealthCheckId) => {
      registry.unregisterHealthCheck(checkId);
    },

    /**
     * Run a single custom health check
     * @param checkId - ID of the check to run
     * @param force - Force execution even if cached
     */
    run: async (checkId: HealthCheckId, force?: boolean) => {
      return registry.runHealthCheck(checkId, api, force);
    },

    /**
     * Run all custom checks matching a trigger
     * @param trigger - Trigger type (e.g., 'mod-activated', 'game-launched')
     */
    runByTrigger: async (trigger: HealthCheckTrigger) => {
      return registry.runChecksByTrigger(trigger, api);
    },

    /**
     * Get all registered custom checks
     */
    getAll: () => {
      return registry.getAll();
    },
  };
}
