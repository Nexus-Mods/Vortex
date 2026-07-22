/**
 * Health check extension
 * Provides health check functionality for mods
 */

import { FlagService } from "@/FlagService";
import type { IExtensionContext } from "@/types/IExtensionContext";
import type { IHealthCheck, IModHealthCheck } from "@/types/IHealthCheck";
import { HealthCheckTrigger } from "@/types/IHealthCheck";

import { activeGameId } from "../../util/selectors";
import { createHealthCheckApi } from "./api";
import { setupAutomaticTriggers } from "./api/triggers";
import {
  fileRequirementsHealthCheck,
  FILE_REQUIREMENTS_FLAG,
} from "./checks/fileRequirementsCheck";
import { modRequirementsHealthCheck } from "./checks/modRequirementsCheck";
import { HealthCheckMenuBadge } from "./components/menu_badge/HealthCheckMenuBadge";
import { HealthCheckRegistry } from "./core/HealthCheckRegistry";
import { LegacyTestAdapter } from "./core/LegacyTestAdapter";
import { persistentReducer } from "./reducers/persistent";
import { sessionReducer } from "./reducers/session";
import type { IHealthCheckApi } from "./types";
import HealthCheckPage from "./views/HealthCheckPage";
import SettingsHealthCheck from "./views/SettingsHealthCheck";

let registry: HealthCheckRegistry | null = null;
let legacyAdapter: LegacyTestAdapter | null = null;
let healthCheckApi: IHealthCheckApi | null = null;

function init(context: IExtensionContext): boolean {
  // Create the registry up front so registerHealthCheck routes directly
  // through it — no buffering, no two-phase setup.
  registry = new HealthCheckRegistry(context.api);

  context.registerHealthCheck = (hc: IHealthCheck | IModHealthCheck) => {
    registry.register(hc);
  };

  // Register session reducer for health check state (registered in both main and renderer)
  context.registerReducer(["session", "healthCheck"], sessionReducer);

  // Register persistent reducer for health check settings (hidden mods, etc.)
  context.registerReducer(["persistent", "healthCheck"], persistentReducer);

  // Register health check settings on the Vortex tab (priority 90 = above Data & Privacy)
  context.registerSettings("Vortex", SettingsHealthCheck, undefined, undefined, 100);

  // Register the Health Check page
  context.registerMainPage("health", "Health check", HealthCheckPage, {
    priority: 60,
    hotkey: "H",
    group: "per-game",
    newLayout: true,
    visible: () => activeGameId(context.api.getState()) !== undefined,
    menuBadge: HealthCheckMenuBadge,
    props: () => ({
      api: context.api,
      onRefresh: () => healthCheckApi?.runChecksByTrigger?.(HealthCheckTrigger.Manual),
    }),
  });

  context.once(() => {
    legacyAdapter = new LegacyTestAdapter(registry, context.api);

    // Create health check API
    healthCheckApi = createHealthCheckApi(registry, legacyAdapter, context.api);

    setupAutomaticTriggers(context.api, healthCheckApi);

    // Register the requirements health checks. Each check owns its full
    // descriptor (id, triggers, enablement gate, running-state + notification
    // wrapper) in its provider module, so registration here is trivial.
    const checks: IHealthCheck[] = [modRequirementsHealthCheck, fileRequirementsHealthCheck];
    for (const check of checks) {
      healthCheckApi.custom.register(check);
    }

    // Re-run checks when the mod requirements setting changes
    context.api.onStateChange(["persistent", "healthCheck", "modRequirementsEnabled"], () => {
      void healthCheckApi?.runChecksByTrigger?.(HealthCheckTrigger.SettingsChanged);
    });

    // Re-run checks when the file requirements setting changes
    context.api.onStateChange(["persistent", "healthCheck", "fileRequirementsEnabled"], () => {
      void healthCheckApi?.runChecksByTrigger?.(HealthCheckTrigger.SettingsChanged);
    });

    // Re-run the file-level check when the Unleash flag flips. subscribeToFlag
    // fires once immediately (skipped here) and then only on actual changes.
    let initialFlag = true;
    FlagService.instance.subscribeToFlag(FILE_REQUIREMENTS_FLAG, () => {
      if (initialFlag) {
        initialFlag = false;
        return;
      }
      void healthCheckApi?.runChecksByTrigger?.(HealthCheckTrigger.SettingsChanged);
    });
  });

  return true;
}

export default init;
