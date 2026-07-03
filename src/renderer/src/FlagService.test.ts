import type { FeatureFlag } from "@vortex/shared/flags";
import type { FeatureFlagsApi } from "@vortex/shared/preload";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FlagService } from "./FlagService";

// -- window.api mock ---------------------------------------------------------

const mockOnSynchronize = vi.fn<FeatureFlagsApi["onSynchronize"]>();
const mockIpcUnsubscribe = vi.fn<() => void>();
const mockReportMetrics = vi.fn<FeatureFlagsApi["reportMetrics"]>();

function push(flags: FeatureFlag[]) {
  const callback = mockOnSynchronize.mock.calls[0][0];
  callback(flags);
}

// -- Setup / teardown --------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  mockIpcUnsubscribe.mockReset();
  mockOnSynchronize.mockReset();
  mockReportMetrics.mockReset();
  mockOnSynchronize.mockReturnValue(mockIpcUnsubscribe);
  (window as any).api = {
    featureFlags: { onSynchronize: mockOnSynchronize, reportMetrics: mockReportMetrics },
  };
  FlagService.init();
});

afterEach(() => {
  FlagService.destroyIfInitialized();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// -- Lifecycle ---------------------------------------------------------------

describe("lifecycle", () => {
  it("throws if init() is called twice without destroy", () => {
    expect(() => FlagService.init()).toThrow("already initialized");
  });

  it("allows re-init after destroy", () => {
    FlagService.instance.destroy();
    expect(() => FlagService.init()).not.toThrow();
  });

  it("destroyIfInitialized is a no-op when not initialized", () => {
    FlagService.instance.destroy();
    expect(() => FlagService.destroyIfInitialized()).not.toThrow();
  });

  it("instance getter returns undefined when not initialized", () => {
    FlagService.instance.destroy();
    expect(FlagService.instance).toBeUndefined();
  });

  it("subscribes to onSynchronize on init", () => {
    expect(mockOnSynchronize).toHaveBeenCalledOnce();
  });

  it("unsubscribes from IPC on destroy", () => {
    FlagService.instance.destroy();
    expect(mockIpcUnsubscribe).toHaveBeenCalledOnce();
  });
});

// -- Flag reads --------------------------------------------------------------

describe("flags and getFlag", () => {
  it("flags is empty before first push", () => {
    expect(FlagService.instance.flags.size).toBe(0);
  });

  it("flags reflects pushed flags", () => {
    push([{ name: "vortex-test-flag" }]);
    expect(FlagService.instance.flags.size).toBe(1);
    expect(FlagService.instance.flags.get("vortex-test-flag")).toBeDefined();
  });

  it("getFlag returns undefined before first push", () => {
    expect(FlagService.instance.getFlag("vortex-test-flag")).toBeUndefined();
  });

  it("getFlag returns the flag after it is pushed", () => {
    const flag: FeatureFlag = { name: "vortex-test-flag", variant: { name: "variant-1", data: 1 } };
    push([flag]);
    expect(FlagService.instance.getFlag("vortex-test-flag")).toEqual(flag);
  });

  it("getFlag returns undefined when flag is absent from the latest push", () => {
    push([{ name: "vortex-test-flag" }]);
    expect(FlagService.instance.getFlag("vortex-test-flag")).toBeDefined();
    push([]);
    expect(FlagService.instance.getFlag("vortex-test-flag")).toBeUndefined();
  });
});

// -- Subscriptions -----------------------------------------------------------

describe("subscribe", () => {
  it("fires callback with current flags on subscribe", () => {
    const cb = vi.fn();
    FlagService.instance.subscribe(cb);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(new Map());
  });

  it("fires callback when flags are pushed", () => {
    const cb = vi.fn();
    FlagService.instance.subscribe(cb);
    push([{ name: "vortex-test-flag" }]);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("fires callback on each subsequent push", () => {
    const cb = vi.fn();
    FlagService.instance.subscribe(cb);
    push([{ name: "vortex-test-flag" }]);
    push([]);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("unsubscribe stops the callback from firing", () => {
    const cb = vi.fn();
    const unsubscribe = FlagService.instance.subscribe(cb);
    expect(cb).toHaveBeenCalledOnce();
    unsubscribe();
    push([{ name: "vortex-test-flag" }]);
    expect(cb).toHaveBeenCalledOnce();
  });
});

// -- Per-flag subscriptions --------------------------------------------------

describe("subscribeToFlag", () => {
  it("fires callback with current flag on subscribe", () => {
    const cb = vi.fn();
    FlagService.instance.subscribeToFlag("vortex-test-flag", cb);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(undefined, undefined);
  });

  it("fires callback when the subscribed flag appears", () => {
    const cb = vi.fn();
    FlagService.instance.subscribeToFlag("vortex-test-flag", cb);
    push([{ name: "vortex-test-flag" }]);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith(undefined, { name: "vortex-test-flag" });
  });

  it("fires callback when the subscribed flag disappears", () => {
    const cb = vi.fn();
    push([{ name: "vortex-test-flag" }]);
    FlagService.instance.subscribeToFlag("vortex-test-flag", cb);
    push([]);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, undefined, { name: "vortex-test-flag" });
    expect(cb).toHaveBeenNthCalledWith(2, { name: "vortex-test-flag" }, undefined);
  });

  it("fires callback when the flag variant changes", () => {
    const before: FeatureFlag = {
      name: "vortex-test-flag",
      variant: { name: "variant-1", data: 1 },
    };
    const after: FeatureFlag = {
      name: "vortex-test-flag",
      variant: { name: "variant-2", data: 2 },
    };
    push([before]);
    const cb = vi.fn();
    FlagService.instance.subscribeToFlag("vortex-test-flag", cb);
    push([after]);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, undefined, before);
    expect(cb).toHaveBeenNthCalledWith(2, before, after);
  });

  it("does not fire when the flag is unchanged between pushes", () => {
    const flag: FeatureFlag = { name: "vortex-test-flag" };
    push([flag]);
    const cb = vi.fn();
    FlagService.instance.subscribeToFlag("vortex-test-flag", cb);
    push([flag]);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(undefined, flag);
  });

  it("does not fire when a push contains no change to the subscribed flag", () => {
    // Push with a flag present, subscribe, then push with the flag absent and
    // no other changes to the subscribed flag -- callback must not fire because
    // the subscribed flag itself did not change in that second push.
    const cb = vi.fn();
    FlagService.instance.subscribeToFlag("vortex-test-flag", cb);
    // Push an empty update: subscribed flag goes from undefined -> undefined, no change.
    push([]);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(undefined, undefined);
  });

  it("unsubscribe stops the callback from firing", () => {
    const cb = vi.fn();
    const unsubscribe = FlagService.instance.subscribeToFlag("vortex-test-flag", cb);
    expect(cb).toHaveBeenCalledOnce();
    unsubscribe();
    push([{ name: "vortex-test-flag" }]);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("cleans up the subscriber set after the last unsubscribe", () => {
    const cb = vi.fn();
    const unsubscribe = FlagService.instance.subscribeToFlag("vortex-test-flag", cb);
    unsubscribe();
    // Access the private map indirectly: a second push must not throw
    expect(() => push([{ name: "vortex-test-flag" }])).not.toThrow();
  });
});

// -- Metrics -----------------------------------------------------------------

describe("metrics", () => {
  it("does not call reportMetrics when nothing has been evaluated", () => {
    FlagService.instance.destroy();
    expect(mockReportMetrics).not.toHaveBeenCalled();
  });

  it("reports a yes count for an enabled flag", () => {
    push([{ name: "vortex-test-flag" }]);
    FlagService.instance.getFlag("vortex-test-flag");
    FlagService.instance.destroy();

    expect(mockReportMetrics).toHaveBeenCalledOnce();
    const bucket = mockReportMetrics.mock.calls[0][0];
    expect(bucket.toggles["vortex-test-flag"].yes).toBeGreaterThanOrEqual(1);
  });

  it("reports a no count for an absent flag", () => {
    FlagService.instance.getFlag("vortex-test-flag");
    FlagService.instance.destroy();

    expect(mockReportMetrics).toHaveBeenCalledOnce();
    const bucket = mockReportMetrics.mock.calls[0][0];
    expect(bucket.toggles["vortex-test-flag"].no).toBeGreaterThanOrEqual(1);
  });

  it("reports variant counts when a flag has a variant", () => {
    push([{ name: "vortex-test-flag", variant: { name: "variant-1", data: 99 } }]);
    FlagService.instance.getFlag("vortex-test-flag");
    FlagService.instance.destroy();

    const bucket = mockReportMetrics.mock.calls[0][0];
    expect(bucket.toggles["vortex-test-flag"].variants?.["variant-1"]).toBeGreaterThanOrEqual(1);
  });

  it("omits variants from the bucket entry when none were seen", () => {
    push([{ name: "vortex-test-flag" }]);
    FlagService.instance.getFlag("vortex-test-flag");
    FlagService.instance.destroy();

    const bucket = mockReportMetrics.mock.calls[0][0];
    expect(bucket.toggles["vortex-test-flag"].variants).toBeUndefined();
  });

  it("flushes automatically after 60 seconds", () => {
    push([{ name: "vortex-test-flag" }]);
    FlagService.instance.getFlag("vortex-test-flag");

    expect(mockReportMetrics).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(mockReportMetrics).toHaveBeenCalledOnce();
  });

  it("resets counts after a flush so the next empty bucket does not report", () => {
    push([{ name: "vortex-test-flag" }]);
    FlagService.instance.getFlag("vortex-test-flag");

    vi.advanceTimersByTime(60_000);
    expect(mockReportMetrics).toHaveBeenCalledTimes(1);

    // No new evaluations — second interval should not flush
    vi.advanceTimersByTime(60_000);
    expect(mockReportMetrics).toHaveBeenCalledTimes(1);
  });

  it("flushes on destroy and does not double-report at the next interval", () => {
    push([{ name: "vortex-test-flag" }]);
    FlagService.instance.getFlag("vortex-test-flag");

    FlagService.instance.destroy();
    expect(mockReportMetrics).toHaveBeenCalledOnce();

    // Interval was cleared, so no second call
    vi.advanceTimersByTime(60_000);
    expect(mockReportMetrics).toHaveBeenCalledOnce();
  });
});
