/**
 * Health check extension
 * Provides health check functionality for mods
 */

import { activeGameId } from "../../util/selectors";
import type { IExtensionContext } from "../../types/IExtensionContext";
import HealthCheckPage from "./views/HealthCheckPage";
import { HealthCheckRegistry } from "./core/HealthCheckRegistry";
import { LegacyTestAdapter } from "./core/LegacyTestAdapter";
import { setupNexusBridgeRenderer } from "./ipc/nexus-bridge";
import { createHealthCheckApi } from "./api";
import { setupAutomaticTriggers } from "./api/triggers";
import {
  HealthCheckCategory,
  HealthCheckTrigger,
  HealthCheckSeverity,
} from "../../types/IHealthCheck";
import { sessionReducer } from "./reducers/session";
import { onDownloadRequirements } from "./util";
import type { IHealthCheckApi } from "./types";

let registry: HealthCheckRegistry | null = null;
let legacyAdapter: LegacyTestAdapter | null = null;
let healthCheckApi: IHealthCheckApi | null = null;

function init(context: IExtensionContext): boolean {
  // Only register this page in development mode
  const isDevelopment = process.env.NODE_ENV !== "production";

  if (!isDevelopment) {
    return false; // Don't initialize in production
  }

  // Register session reducer for health check state (registered in both main and renderer)
  context.registerReducer(["session", "healthCheck"], sessionReducer);

  // Register the Health Check page
  context.registerMainPage("health", "Health Check", HealthCheckPage, {
    hotkey: "H",
    group: "per-game",
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    props: () => ({
      api: context.api,
      onRefresh: () =>
        healthCheckApi?.runChecksByTrigger?.(HealthCheckTrigger.Manual),
      onDownloadRequirements: (modIds: number[]) =>
        onDownloadRequirements(
          context.api,
          activeGameId(context.api.store.getState())!,
          modIds,
        ),
    }),
    priority: 0, // Force top of game section
  });

  context.once(() => {
    // Create local registry for renderer-side checks
    registry = new HealthCheckRegistry(context.api);
    legacyAdapter = new LegacyTestAdapter(registry, context.api);

    // Set up IPC bridge for main process to call Nexus API
    setupNexusBridgeRenderer(context.api);

    // Create health check API using separated modules
    healthCheckApi = createHealthCheckApi(registry, legacyAdapter, context.api);

    setupAutomaticTriggers(context.api, healthCheckApi);

    // Register the nexus requirements check that delegates to main process
    healthCheckApi.custom.register({
      id: "nexus-requirements",
      name: "Nexus Mod Requirements",
      description: "Validates that all Nexus mod requirements are satisfied",
      category: HealthCheckCategory.Requirements,
      severity: HealthCheckSeverity.Info,
      triggers: [
        HealthCheckTrigger.ModsChanged,
        HealthCheckTrigger.Manual,
        HealthCheckTrigger.ProfileChanged,
        HealthCheckTrigger.GameChanged,
      ],
      check: async () => {
        const result = await healthCheckApi!.predefined.run(
          "check-nexus-mod-requirements",
        );
        context.api.sendNotification({
          type: "info",
          message: "Nexus Mod Requirements check completed",
          displayMS: 5000,
          id: "health-check:nexus-requirements-complete",
        });
        return result;
      },
    });
  });

  return true;
}

export default init;
