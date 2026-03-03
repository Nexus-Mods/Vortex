import { unknownToError } from '@vortex/shared';

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IHealthCheckResult } from "../../../types/IHealthCheck";
import type { IHealthCheckApi } from "../types";

import { log } from "../../../logging";
import { HealthCheckTrigger } from "../../../types/IHealthCheck";
import Debouncer from "../../../util/Debouncer";
import { hasCollectionActiveSession } from "../../collections_integration/selectors";

/**
 * Setup automatic triggers for health checks
 * Listens to Vortex events and triggers appropriate health checks via IPC
 */
export function setupAutomaticTriggers(
  api: IExtensionApi,
  healthCheckApi: IHealthCheckApi,
): void {
  if (!api || !api.events) {
    log("warn", "Cannot setup automatic triggers: API or events not available");
    return;
  }

  try {
    // Check if events object has the required methods
    if (typeof api.events.on !== "function") {
      log(
        "warn",
        "Cannot setup automatic triggers: api.events.on is not a function",
      );
      return;
    }

    // Game changed trigger
    api.events.on("gamemode-activated", (gameMode: string) => {
      log("debug", "Triggering game change health checks", { gameMode });
      void triggerHealthChecks(api, healthCheckApi, HealthCheckTrigger.GameChanged);
    });

    // Profile changed trigger
    api.events.on("profile-did-change", (profileId: string) => {
      log("debug", "Triggering profile change health checks", { profileId });
      void triggerHealthChecks(api, healthCheckApi, HealthCheckTrigger.ProfileChanged);
    });

    // Settings changed trigger
    api.events.on("settings-changed", (path: string[]) => {
      log("debug", "Triggering settings change health checks", { path });
      void triggerHealthChecks(api, healthCheckApi, HealthCheckTrigger.SettingsChanged);
    });

    // Mods changed triggers - debounced because did-install-mod and
    // did-enable-mods fire in quick succession for the same install, and
    // setModsEnabled() in InstallManager is not awaited so state may not
    // be updated when the first event fires.
    const modsChangedDebouncer = new Debouncer(
      () =>
        void triggerHealthChecks(api, healthCheckApi, HealthCheckTrigger.ModsChanged),
      500,
    );

    api.events.on("did-install-mod", () => {
      log("debug", "Mod installed, scheduling debounced health check");
      modsChangedDebouncer.schedule();
    });

    api.onAsync("did-enable-mods", () => {
      log("debug", "Mods enabled, scheduling debounced health check");
      modsChangedDebouncer.schedule();
      return Promise.resolve();
    });

    // Run health checks after collection post-processing finishes,
    // matching the pattern used by gamebryo-plugin-management for LOOT.
    api.events.on("collection-postprocess-complete", () => {
      log("debug", "Collection post-processing complete, triggering health checks");
      void triggerHealthChecks(api, healthCheckApi, HealthCheckTrigger.ModsChanged);
    });

    api.onStateChange?.(
      ["session", "healthCheck", "lastFullRun"],
      (lastFullRun) => {
        log("debug", "Triggering requirements change health checks", {
          lastFullRun,
        });
        void triggerHealthChecks(api, healthCheckApi, HealthCheckTrigger.ResultsChanged);
      },
    );

    log("debug", "Automatic triggers setup complete");
  } catch (error) {
    const err = error as Error;
    log("error", "Failed to setup automatic triggers", { error: err.message });
  }
}

/**
 * Trigger health checks for a specific trigger type.
 * Suppressed during collection installation (except Manual) — checks
 * run after collection-postprocess-complete instead.
 */
async function triggerHealthChecks(
  api: IExtensionApi,
  healthCheckApi: IHealthCheckApi,
  trigger: HealthCheckTrigger,
): Promise<void> {
  if (
    trigger !== HealthCheckTrigger.Manual &&
    hasCollectionActiveSession(api.getState())
  ) {
    return;
  }

  try {
    const results = await healthCheckApi.runChecksByTrigger(trigger);
    log("debug", "Health checks completed", {
      trigger,
      totalChecks: results.length,
      passed: results.filter((r) => r.status === "passed").length,
      warnings: results.filter((r) => r.status === "warning").length,
      errors: results.filter((r) => r.status === "error").length,
      failed: results.filter((r) => r.status === "failed").length,
    });
  } catch (error) {
    const err = unknownToError(error);
    log("error", "Failed to trigger health checks", {
      trigger,
      error: err.message,
    });
    api.showErrorNotification(
      "Failed to run health checks",
      "An error occurred while running health checks. Please check the logs for details.",
    );
    return;
  }
}

/**
 * Manually trigger all health checks
 */
export async function manualTrigger(
  healthCheckApi: IHealthCheckApi,
): Promise<IHealthCheckResult[]> {
  return healthCheckApi.runChecksByTrigger(HealthCheckTrigger.Manual);
}
