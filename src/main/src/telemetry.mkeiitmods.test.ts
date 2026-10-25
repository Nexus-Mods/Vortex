import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exporter: vi.fn(),
  startSpan: vi.fn(),
  clientStart: vi.fn(),
  handle: vi.fn(),
  on: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: () => "/tmp", getVersion: () => "1.0.0" },
  BrowserWindow: { getAllWindows: () => [] },
}));
vi.mock("./logging", () => ({ log: vi.fn() }));
vi.mock("./ipc", () => ({ betterIpcMain: { handle: mocks.handle, on: mocks.on } }));
vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: class {
    constructor() {
      mocks.exporter();
    }
  },
}));
vi.mock("@opentelemetry/sdk-trace-base", () => ({
  SimpleSpanProcessor: class {},
  BasicTracerProvider: class {
    getTracer() {
      return { startSpan: mocks.startSpan };
    }
    forceFlush = vi.fn();
    shutdown = vi.fn();
  },
}));

import { TELEMETRY_ENABLED } from "@vortex/shared";

import { isErrorReportingDisabled, reportCrash } from "./errorReporting";
import {
  isTelemetryEnabled,
  isUnconsentedReportingEnabled,
  setTelemetryEnabled,
  setUnconsentedReportingEnabled,
} from "./telemetry/state";
import type { UnleashClient } from "./unleash/client";
import { synchronizeFeatureFlags } from "./unleash/ipc";

// Everything here would go to Nexus Mods services that belong to Vortex.
describe("mkeiitmods telemetry", () => {
  it("ships switched off", () => {
    expect(TELEMETRY_ENABLED).toBe(false);
  });

  it("does not export traces even after the user consents", () => {
    setTelemetryEnabled(true);
    setUnconsentedReportingEnabled(true);
    expect(isTelemetryEnabled()).toBe(false);
    expect(isUnconsentedReportingEnabled()).toBe(false);
  });

  it("never sends crash reports and offers no report button", async () => {
    expect(isErrorReportingDisabled()).toBe(true);
    await reportCrash("Crash", { message: "boom" }, undefined, "main", true);
    expect(mocks.exporter).not.toHaveBeenCalled();
    expect(mocks.startSpan).not.toHaveBeenCalled();
  });

  it("never contacts the feature flag server", () => {
    const client = { start: mocks.clientStart } as unknown as UnleashClient;
    synchronizeFeatureFlags(client);
    expect(mocks.clientStart).not.toHaveBeenCalled();
    const getCurrent = mocks.handle.mock.calls.find(([name]) => name === "flags:get-current") as
      | [string, () => unknown]
      | undefined;
    expect(getCurrent?.[1]()).toEqual([]);
  });
});
