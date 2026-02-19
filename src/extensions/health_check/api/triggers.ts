import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";
import { HealthCheckTrigger } from "../../../renderer/types/IHealthCheck";
import type { IHealthCheckResult } from "../../../renderer/types/IHealthCheck";
import { log } from "../../../renderer/util/log";
import type { IHealthCheckApi } from "../types";

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
      triggerHealthChecks(healthCheckApi, HealthCheckTrigger.GameChanged);
    });

    // Profile changed trigger
    api.events.on("profile-did-change", (profileId: string) => {
      log("debug", "Triggering profile change health checks", { profileId });
      triggerHealthChecks(healthCheckApi, HealthCheckTrigger.ProfileChanged);
    });

    // Settings changed trigger
    api.events.on("settings-changed", (path: string[]) => {
      log("debug", "Triggering settings change health checks", { path });
      triggerHealthChecks(healthCheckApi, HealthCheckTrigger.SettingsChanged);
    });

    // Mods changed triggers
    api.events.on("did-install-mod", () => {
      log("debug", "Triggering mod change health checks (installed)");
      triggerHealthChecks(healthCheckApi, HealthCheckTrigger.ModsChanged);
    });

    api.onAsync("did-enable-mods", () => {
      log("debug", "Triggering mod change health checks (deployed)");
      triggerHealthChecks(healthCheckApi, HealthCheckTrigger.ModsChanged);
      return Promise.resolve();
    });

    api.onStateChange?.(
      ["session", "healthCheck", "lastFullRun"],
      (lastFullRun) => {
        log("debug", "Triggering requirements change health checks", {
          lastFullRun,
        });
        triggerHealthChecks(healthCheckApi, HealthCheckTrigger.ResultsChanged);
      },
    );

    log("debug", "Automatic triggers setup complete");
  } catch (error) {
    const err = error as Error;
    log("error", "Failed to setup automatic triggers", { error: err.message });
  }
}

/**
 * Trigger health checks for a specific trigger type
 */
function triggerHealthChecks(
  healthCheckApi: IHealthCheckApi,
  trigger: HealthCheckTrigger,
): void {
  // Run checks asynchronously to avoid blocking
  healthCheckApi
    .runChecksByTrigger(trigger)
    .then((results) => {
      log("debug", "Health checks completed", {
        trigger,
        totalChecks: results.length,
        passed: results.filter((r) => r.status === "passed").length,
        warnings: results.filter((r) => r.status === "warning").length,
        errors: results.filter((r) => r.status === "error").length,
        failed: results.filter((r) => r.status === "failed").length,
      });
    })
    .catch((error) => {
      const err = error as Error;
      log("error", "Failed to run health checks", {
        trigger,
        error: err.message,
      });
    });
}

/**
 * Manually trigger all health checks
 */
export async function manualTrigger(
  healthCheckApi: IHealthCheckApi,
): Promise<IHealthCheckResult[]> {
  return healthCheckApi.runChecksByTrigger(HealthCheckTrigger.Manual);
}
