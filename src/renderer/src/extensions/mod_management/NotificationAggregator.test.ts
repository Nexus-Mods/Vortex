import { describe, expect, vi, beforeEach, afterEach, test } from "vitest";

import type { IExtensionApi } from "../../types/IExtensionContext";

import { NotificationAggregator } from "./NotificationAggregator";

// Mock API for testing
const mockApi = {
  showErrorNotification: vi.fn(),
  sendNotification: vi.fn(),
};

describe("NotificationAggregator", () => {
  let aggregator: NotificationAggregator;

  beforeEach(() => {
    aggregator = new NotificationAggregator(
      mockApi as unknown as IExtensionApi,
    );
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should show notifications immediately when aggregation is not active", async () => {
    aggregator.addNotification(
      "test-session",
      "error",
      "Test Error",
      "Test message",
      "TestMod",
      { allowReport: false },
    );

    // Run any pending timers/setImmediate
    await vi.runAllTimersAsync();

    expect(mockApi.showErrorNotification).toHaveBeenCalledWith(
      "Test Error",
      "Test message",
      {
        message: "TestMod",
        allowReport: false,
        actions: undefined,
      },
    );
  });

  test("should aggregate similar notifications", async () => {
    aggregator.startAggregation("test-session", 0);

    aggregator.addNotification(
      "test-session",
      "error",
      "Failed to install dependency",
      "Download failed",
      "Mod1",
    );
    aggregator.addNotification(
      "test-session",
      "error",
      "Failed to install dependency",
      "Download failed",
      "Mod2",
    );
    aggregator.addNotification(
      "test-session",
      "error",
      "Failed to install dependency",
      "Download failed",
      "Mod3",
    );

    const flushPromise = aggregator.flushAggregation("test-session");
    await vi.runAllTimersAsync();
    await flushPromise;

    expect(mockApi.showErrorNotification).toHaveBeenCalledTimes(1);
    const [title, message, options] = mockApi.showErrorNotification.mock
      .calls[0] as [string, string, { allowReport: unknown; id: string }];
    expect(title).toBe("Failed to install dependency (3 dependencies)");
    expect(message).toContain("Affected dependencies: Mod1, Mod2, Mod3");
    expect(options.allowReport).toBeUndefined();
    expect(options.id).toContain("aggregated-");
  });

  test("should handle different error types separately", async () => {
    aggregator.startAggregation("test-session", 0);

    aggregator.addNotification(
      "test-session",
      "error",
      "Download failed",
      "Connection error",
      "Mod1",
    );
    aggregator.addNotification(
      "test-session",
      "error",
      "Invalid URL",
      "Malformed URL",
      "Mod2",
    );

    const flushPromise = aggregator.flushAggregation("test-session");
    await vi.runAllTimersAsync();
    await flushPromise;

    expect(mockApi.showErrorNotification).toHaveBeenCalledTimes(2);
  });

  test("should handle many dependencies by truncating the list", async () => {
    aggregator.startAggregation("test-session", 0);

    for (let i = 1; i <= 7; i++) {
      aggregator.addNotification(
        "test-session",
        "error",
        "Failed to install dependency",
        "Download failed",
        `Mod${i}`,
      );
    }

    const flushPromise = aggregator.flushAggregation("test-session");
    await vi.runAllTimersAsync();
    await flushPromise;

    expect(mockApi.showErrorNotification).toHaveBeenCalledTimes(1);
    const [title, message, options] = mockApi.showErrorNotification.mock
      .calls[0] as [string, string, { allowReport: unknown; id: string }];
    expect(title).toBe("Failed to install dependency (7 dependencies)");
    expect(message).toContain("and 2 more");
    expect(options.allowReport).toBeUndefined();
    expect(options.id).toContain(
      "aggregated-error-Failed to install dependency",
    );
  });

  test("should auto-flush on timeout", async () => {
    aggregator.startAggregation("test-session", 100);

    aggregator.addNotification(
      "test-session",
      "error",
      "Test Error",
      "Test message",
      "TestMod",
    );

    // Advance timers past the timeout to trigger the auto-flush
    await vi.advanceTimersByTimeAsync(150);

    // Stop the aggregation (which flushes remaining notifications)
    const stopPromise = aggregator.stopAggregation("test-session");
    await vi.runAllTimersAsync();
    await stopPromise;

    expect(mockApi.showErrorNotification).toHaveBeenCalledTimes(1);
  });

  test("should stop aggregation and flush notifications", async () => {
    aggregator.startAggregation("test-session", 0);
    aggregator.addNotification(
      "test-session",
      "error",
      "Test Error",
      "Test message",
      "TestMod",
    );

    const stopPromise = aggregator.stopAggregation("test-session");
    await vi.runAllTimersAsync();
    await stopPromise;

    expect(mockApi.showErrorNotification).toHaveBeenCalledTimes(1);
    expect(aggregator.isAggregating("test-session")).toBe(false);
  });
});
