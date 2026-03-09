/**
 * Health check extension
 * Provides health check functionality for mods
 */

import type { IExtensionContext } from "../../types/IExtensionContext";
import type {
  IHealthCheckApi,
  IModFileInfo,
  IModRequirementExt,
} from "./types";

import {
  HealthCheckCategory,
  HealthCheckTrigger,
  HealthCheckSeverity,
} from "../../types/IHealthCheck";
import { activeGameId } from "../../util/selectors";
import { setHealthCheckRunning } from "./actions/session";
import { createHealthCheckApi } from "./api";
import { setupAutomaticTriggers } from "./api/triggers";
import {
  checkModRequirements,
  MOD_REQUIREMENTS_CHECK_ID,
} from "./checks/modRequirementsCheck";
import { HealthCheckRegistry } from "./core/HealthCheckRegistry";
import { LegacyTestAdapter } from "./core/LegacyTestAdapter";
import { persistentReducer } from "./reducers/persistent";
import { sessionReducer } from "./reducers/session";
import { isModRequirementsEnabled } from "./selectors";
import { onDownloadRequirement } from "./util";
import HealthCheckPage from "./views/HealthCheckPage";
import SettingsHealthCheck from "./views/SettingsHealthCheck";

let registry: HealthCheckRegistry | null = null;
let legacyAdapter: LegacyTestAdapter | null = null;
let healthCheckApi: IHealthCheckApi | null = null;

function init(context: IExtensionContext): boolean {
  // Register session reducer for health check state (registered in both main and renderer)
  context.registerReducer(["session", "healthCheck"], sessionReducer);

  // Register persistent reducer for health check settings (hidden mods, etc.)
  context.registerReducer(["persistent", "healthCheck"], persistentReducer);

  // Register health check settings on the Vortex tab (priority 90 = above Data & Privacy)
  context.registerSettings(
    "Vortex",
    SettingsHealthCheck,
    undefined,
    undefined,
    100,
  );

  // Register the Health Check page
  context.registerMainPage("health", "Health Check", HealthCheckPage, {
    hotkey: "H",
    group: "per-game",
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    props: () => ({
      api: context.api,
      onRefresh: () =>
        healthCheckApi?.runChecksByTrigger?.(HealthCheckTrigger.Manual),
      onDownloadRequirement: async (
        req: IModRequirementExt,
        file?: IModFileInfo,
      ) => {
        await onDownloadRequirement(context.api, req, file);
      },
    }),
    priority: 0, // Force top of game section
  });

  context.once(() => {
    // Create local registry for health checks
    registry = new HealthCheckRegistry(context.api);
    legacyAdapter = new LegacyTestAdapter(registry, context.api);

    // Create health check API
    healthCheckApi = createHealthCheckApi(registry, legacyAdapter, context.api);

    setupAutomaticTriggers(context.api, healthCheckApi);

    // Register the nexus requirements check
    healthCheckApi.custom.register({
      id: MOD_REQUIREMENTS_CHECK_ID,
      name: "Nexus Mod Requirements",
      description: "Validates that all Nexus mod requirements are satisfied",
      category: HealthCheckCategory.Requirements,
      severity: HealthCheckSeverity.Info,
      triggers: [
        HealthCheckTrigger.ModsChanged,
        HealthCheckTrigger.Manual,
        HealthCheckTrigger.ProfileChanged,
        HealthCheckTrigger.GameChanged,
        HealthCheckTrigger.SettingsChanged,
      ],
      check: async () => {
        // Skip check if mod requirements suggestions are disabled
        if (!isModRequirementsEnabled(context.api.getState())) {
          return {
            checkId: MOD_REQUIREMENTS_CHECK_ID,
            status: "passed" as const,
            severity: HealthCheckSeverity.Info,
            message: "Mod requirements check disabled",
            executionTime: 0,
            timestamp: new Date(),
          };
        }

        context.api.store?.dispatch(
          setHealthCheckRunning(MOD_REQUIREMENTS_CHECK_ID, true),
        );
        try {
          const result = await checkModRequirements(context.api);
          context.api.sendNotification({
            type: "info",
            message: "Nexus Mod Requirements check completed",
            displayMS: 5000,
            id: "health-check:nexus-requirements-complete",
          });
          return result;
        } finally {
          context.api.store?.dispatch(
            setHealthCheckRunning(MOD_REQUIREMENTS_CHECK_ID, false),
          );
        }
      },
    });

    // Re-run checks when the mod requirements setting changes
    context.api.onStateChange(
      ["persistent", "healthCheck", "modRequirementsEnabled"],
      () => {
        void healthCheckApi?.runChecksByTrigger?.(
          HealthCheckTrigger.SettingsChanged,
        );
      },
    );
  });

  return true;
}

export default init;
