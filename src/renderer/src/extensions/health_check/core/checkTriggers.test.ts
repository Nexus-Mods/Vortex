import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { HealthCheckTrigger } from "../../../types/IHealthCheck";
import { fileRequirementsHealthCheck } from "../checks/fileRequirementsCheck";
import { fomodOptionsHealthCheck } from "../checks/fomodOptionsCheck";
import { modRequirementsHealthCheck } from "../checks/modRequirementsCheck";
import { HealthCheckRegistry } from "../core/HealthCheckRegistry";

/**
 * Which checks a trigger actually reaches, over the real registry and the real check
 * descriptors.
 *
 * This is the half of the plugin-list wiring that a test of `triggers.ts` alone cannot see:
 * dispatching PluginsChanged is only worth anything if the installer-options check is
 * registered for it, and only cheap if the two Nexus-backed checks are not.
 */
const registryWithEveryCheck = (api: IExtensionApi): HealthCheckRegistry => {
  const registry = new HealthCheckRegistry(api);
  for (const check of [
    modRequirementsHealthCheck,
    fileRequirementsHealthCheck,
    fomodOptionsHealthCheck,
  ]) {
    registry.register(check);
  }
  return registry;
};

const api = {
  getState: () => ({ persistent: {}, session: {}, settings: {} }),
  store: { dispatch: vi.fn() },
  events: { emit: vi.fn() },
} as unknown as IExtensionApi;

const idsFor = (trigger: HealthCheckTrigger): string[] =>
  registryWithEveryCheck(api)
    .getByTrigger(trigger)
    .map((entry) => entry.healthCheck.id)
    .sort();

describe("which checks the plugin-list trigger reaches", () => {
  it("runs the installer-options check on its own", () => {
    // A plugin move must not drag the two Nexus-backed checks along with it: plugin writes
    // are far more frequent than mod changes (every deploy, sort and warning update).
    expect(idsFor(HealthCheckTrigger.PluginsChanged)).toEqual(["check-fomod-option-availability"]);
  });

  it("still runs the installer-options check when mods change", () => {
    // Installing Mod B is what brings the plugin, so the mod path has to reach it too.
    expect(idsFor(HealthCheckTrigger.ModsChanged)).toContain("check-fomod-option-availability");
  });

  it("runs it on a manual refresh and on a game or profile switch", () => {
    for (const trigger of [
      HealthCheckTrigger.Manual,
      HealthCheckTrigger.GameChanged,
      HealthCheckTrigger.ProfileChanged,
    ]) {
      expect(idsFor(trigger)).toContain("check-fomod-option-availability");
    }
  });
});
