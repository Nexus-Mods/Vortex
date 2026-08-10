import { unknownToError } from "@vortex/shared";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IHealthCheckResult } from "../../../types/IHealthCheck";
import { HealthCheckTrigger } from "../../../types/IHealthCheck";
import { hasCollectionActiveSession } from "../../../util/collectionInstallSessionSelectors";
import Debouncer from "../../../util/Debouncer";
import { isLoggedIn } from "../../nexus_integration/selectors";
import type { IHealthCheckApi } from "../types";

/**
 * Setup automatic triggers for health checks
 * Listens to Vortex events and triggers appropriate health checks via IPC
 */
export function setupAutomaticTriggers(api: IExtensionApi, healthCheckApi: IHealthCheckApi): void {
  if (!api || !api.events) {
    log("warn", "Cannot setup automatic triggers: API or events not available");
    return;
  }

  try {
    // Check if events object has the required methods
    if (typeof api.events.on !== "function") {
      log("warn", "Cannot setup automatic triggers: api.events.on is not a function");
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

    // Login changed trigger - fires only when whether we actually have Nexus
    // login data flips, not on every credential write.
    let wasLoggedIn = isLoggedIn(api.getState());
    api.onStateChange?.(["confidential", "account", "nexus"], () => {
      const isNowLoggedIn = isLoggedIn(api.getState());
      if (isNowLoggedIn === wasLoggedIn) {
        return;
      }
      wasLoggedIn = isNowLoggedIn;
      log("debug", "Login state changed, triggering health checks", { isNowLoggedIn });
      void triggerHealthChecks(api, healthCheckApi, HealthCheckTrigger.LoginChanged);
    });

    // Mods changed triggers - debounced because these events can fire in quick
    // succession (e.g. a batch enable/disable, or did-install-mod alongside
    // setModsEnabled() in InstallManager, which isn't awaited so state may not
    // be updated when the first event fires).
    const modsChangedDebouncer = new Debouncer(
      () => triggerHealthChecks(api, healthCheckApi, HealthCheckTrigger.ModsChanged),
      500,
    );

    api.events.on("did-install-mod", () => {
      log("debug", "Mod installed, scheduling debounced health check");
      modsChangedDebouncer.schedule();
    });

    // mod-enabled/mod-disabled are derived from a diff of the active profile's
    // modState, so they fire for every enable/disable path (single toggle,
    // bulk selection, profile switch, dependency auto-enable, etc.).
    api.events.on("mod-enabled", () => {
      log("debug", "Mod enabled, scheduling debounced health check");
      modsChangedDebouncer.schedule();
    });

    api.events.on("mod-disabled", () => {
      log("debug", "Mod disabled, scheduling debounced health check");
      modsChangedDebouncer.schedule();
    });

    api.onAsync("did-enable-mods", () => {
      log("debug", "Mods enabled, scheduling debounced health check");
      modsChangedDebouncer.schedule();
      return Promise.resolve();
    });

    // did-remove-mod/did-remove-mods fire once removal (undeploy + delete)
    // actually completes, from the single handler every removal path funnels
    // through (ModList, collections, ModHistory undo).
    api.events.on("did-remove-mod", () => {
      log("debug", "Mod removed, scheduling debounced health check");
      modsChangedDebouncer.schedule();
    });

    api.events.on("did-remove-mods", () => {
      log("debug", "Mods removed, scheduling debounced health check");
      modsChangedDebouncer.schedule();
    });

    // Downloads are deleted/added from many call sites with no single
    // completion event (deleting an archive alongside a mod, deleting an
    // archive-only entry, external cleanup, etc.), so watch the state
    // directly rather than chasing every emit site. A requirement can be
    // satisfied by a downloaded-but-not-installed archive, so this affects
    // what the checks report even though it isn't a mod install/enable.
    api.onStateChange?.(
      ["persistent", "downloads", "files"],
      (previous: Record<string, unknown>, current: Record<string, unknown>) => {
        const previousKeys = Object.keys(previous ?? {});
        const currentKeys = Object.keys(current ?? {});
        const changed =
          previousKeys.length !== currentKeys.length ||
          previousKeys.some((id) => !(id in (current ?? {})));
        if (!changed) {
          return;
        }
        log("debug", "Downloads changed, scheduling debounced health check");
        modsChangedDebouncer.schedule();
      },
    );

    // Run health checks after collection post-processing finishes,
    // matching the pattern used by gamebryo-plugin-management for LOOT.
    api.events.on("collection-postprocess-complete", () => {
      log("debug", "Collection post-processing complete, triggering health checks");
      void triggerHealthChecks(api, healthCheckApi, HealthCheckTrigger.ModsChanged);
    });

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
  if (trigger !== HealthCheckTrigger.Manual && hasCollectionActiveSession(api.getState())) {
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
