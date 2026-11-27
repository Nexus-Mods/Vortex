/**
 * The automatic triggers, as the plugin-list watcher sees them.
 *
 * Two things here are easy to get wrong silently and impossible to see from the UI: which
 * state slices the watcher subscribes to, and which trigger it dispatches. Enabling a plugin
 * writes `loadOrder` only, so watching `pluginList` alone misses the common case; and
 * dispatching ModsChanged would drag the two Nexus-backed checks along on every plugin move.
 */
import { EventEmitter } from "events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { HealthCheckTrigger } from "../../../types/IHealthCheck";
import type { IHealthCheckApi } from "../types";
import { setupAutomaticTriggers } from "./triggers";

interface IHarness {
  api: IExtensionApi;
  runChecksByTrigger: ReturnType<typeof vi.fn>;
  /** Fire every state-change handler registered for the given slice. */
  changeState: (slice: string[]) => void;
  /** The slices anything subscribed to. */
  watchedSlices: string[][];
}

const createHarness = (): IHarness => {
  const watchedSlices: string[][] = [];
  const listeners = new Map<string, (() => void)[]>();
  const events = new EventEmitter();
  const runChecksByTrigger = vi.fn().mockResolvedValue([]);

  const api = {
    events,
    // Just enough for the logged-in check the login watcher seeds itself from.
    getState: () => ({ confidential: { account: {} } }),
    onAsync: () => Promise.resolve(),
    onStateChange: (slice: string[], cb: () => void) => {
      watchedSlices.push(slice);
      const key = slice.join(".");
      listeners.set(key, [...(listeners.get(key) ?? []), cb]);
    },
    showErrorNotification: vi.fn(),
  } as unknown as IExtensionApi;

  const healthCheckApi = { runChecksByTrigger } as unknown as IHealthCheckApi;

  setupAutomaticTriggers(api, healthCheckApi);

  return {
    api,
    runChecksByTrigger,
    watchedSlices,
    changeState: (slice) => {
      for (const cb of listeners.get(slice.join(".")) ?? []) {
        cb();
      }
    },
  };
};

describe("setupAutomaticTriggers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("watches the load order as well as the plugin list", () => {
    // setPluginEnabled writes loadOrder only, so a watcher on pluginList alone never sees
    // the user enabling the plugin the option was waiting for.
    const { watchedSlices } = createHarness();

    expect(watchedSlices).toContainEqual(["loadOrder"]);
    expect(watchedSlices).toContainEqual(["session", "plugins", "pluginList"]);
  });

  it("runs only the plugin-triggered checks when the load order moves", async () => {
    const harness = createHarness();

    harness.changeState(["loadOrder"]);
    await vi.advanceTimersByTimeAsync(600);

    expect(harness.runChecksByTrigger).toHaveBeenCalledTimes(1);
    expect(harness.runChecksByTrigger).toHaveBeenCalledWith(HealthCheckTrigger.PluginsChanged);
  });

  it("runs only the plugin-triggered checks when the plugin list is rewritten", async () => {
    const harness = createHarness();

    harness.changeState(["session", "plugins", "pluginList"]);
    await vi.advanceTimersByTimeAsync(600);

    expect(harness.runChecksByTrigger).toHaveBeenCalledTimes(1);
    expect(harness.runChecksByTrigger).toHaveBeenCalledWith(HealthCheckTrigger.PluginsChanged);
  });

  it("coalesces a burst of plugin changes into one run", async () => {
    const harness = createHarness();

    harness.changeState(["loadOrder"]);
    harness.changeState(["loadOrder"]);
    harness.changeState(["session", "plugins", "pluginList"]);
    await vi.advanceTimersByTimeAsync(600);

    expect(harness.runChecksByTrigger).toHaveBeenCalledTimes(1);
  });

  it("leaves the mod-changed trigger to the mod events", async () => {
    // A plugin move must not re-run the two Nexus-backed checks.
    const harness = createHarness();

    harness.changeState(["loadOrder"]);
    await vi.advanceTimersByTimeAsync(600);

    expect(harness.runChecksByTrigger).not.toHaveBeenCalledWith(HealthCheckTrigger.ModsChanged);
  });
});
