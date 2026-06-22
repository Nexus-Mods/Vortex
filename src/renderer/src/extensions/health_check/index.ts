/**
 * Health check extension
 * Provides health check functionality for mods
 */

import type { FeatureFlag, KnownFlagName } from "@vortex/shared/flags";

import type { IExtensionContext } from "../../types/IExtensionContext";
import type { IHealthCheck, IModHealthCheck } from "../../types/IHealthCheck";
import { HealthCheckTrigger } from "../../types/IHealthCheck";
import { activeGameId } from "../../util/selectors";
import { setFileRequirementsFlagEnabled } from "./actions/persistent";
import { createHealthCheckApi } from "./api";
import { setupAutomaticTriggers } from "./api/triggers";
import { fileRequirementsHealthCheck } from "./checks/fileRequirementsCheck";
import { modRequirementsHealthCheck } from "./checks/modRequirementsCheck";
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

/** Unleash flag gating the file-level requirements feature; must match the Unleash toggle. */
const FILE_REQUIREMENTS_FLAG: KnownFlagName = "vortex-file-level-requirements";

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
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
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

    // Mirror the Unleash file-level-requirements flag into persistent state so the
    // settings UI and the check can gate on it. Flags are pushed only after a
    // successful Unleash poll, so until then the last-known value is kept (fail-closed).
    let flagEnabled: boolean | undefined;
    window.api.featureFlags.onSynchronize((flags: FeatureFlag[]) => {
      const enabled = flags.some((flag) => flag.name === FILE_REQUIREMENTS_FLAG);
      if (enabled === flagEnabled) {
        return;
      }
      flagEnabled = enabled;
      context.api.store?.dispatch(setFileRequirementsFlagEnabled(enabled));
      void healthCheckApi?.runChecksByTrigger?.(HealthCheckTrigger.SettingsChanged);
    });
  });

  return true;
}

export default init;
