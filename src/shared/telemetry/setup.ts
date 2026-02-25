import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import Bluebird from "bluebird";

/**
 * Patch Bluebird's .then() to propagate OTel context per-callback.
 * Captures the active context when .then() is called and restores it
 * when the callback actually runs — even across async boundaries.
 */
function patchBluebirdContext(): void {
  /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
  const originalThen = Bluebird.prototype.then;
  Bluebird.prototype.then = function (
    this: Bluebird<unknown>,
    onFulfilled?: ((...args: any[]) => any) | null,
    onRejected?: ((...args: any[]) => any) | null,
  ) {
    const ctx = context.active();
    const wrappedFulfilled =
      typeof onFulfilled === "function"
        ? (...args: any[]) => context.with(ctx, () => onFulfilled(...args))
        : onFulfilled;
    const wrappedRejected =
      typeof onRejected === "function"
        ? (...args: any[]) => context.with(ctx, () => onRejected(...args))
        : onRejected;
    return originalThen.call(this, wrappedFulfilled, wrappedRejected);
  } as typeof originalThen;
  /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
}

import { VORTEX_VERSION } from "../constants";
import { createVortexResource } from "./resources";
import {
  RingBufferSpanProcessor,
  type RingBufferOptions,
} from "./RingBufferSpanProcessor";

export const OTLP_ENDPOINT =
  process.env.VORTEX_OTLP_ENDPOINT ??
  "https://vortex-collector.nexusmods.com/v1/traces";

export const OTLP_HEADERS: Record<string, string> = {
};

export interface TelemetrySetupResult {
  provider: BasicTracerProvider;
  processor: RingBufferSpanProcessor;
}

/** Process-level singleton reference to the span processor */
let processorSingleton: RingBufferSpanProcessor | undefined;

/** Process-level singleton reference to the resource */
let resourceSingleton: ReturnType<typeof createVortexResource> | undefined;

/** Whether telemetry export is enabled (controlled by analytics opt-in). */
let telemetryExportEnabled = false;

export function setTelemetryEnabled(enabled: boolean): void {
  telemetryExportEnabled = enabled;
}

export function isTelemetryEnabled(): boolean {
  return telemetryExportEnabled;
}

/**
 * Get the Resource for this process (for manual OTLP export).
 * Returns undefined if telemetry hasn't been initialized yet.
 */
export function getResource(): ReturnType<typeof createVortexResource> | undefined {
  return resourceSingleton;
}

/**
 * Create and register a TracerProvider with a RingBufferSpanProcessor.
 * Call this once per process (main or renderer) early in startup.
 */
export function createTelemetryProvider(
  processName: "main" | "renderer",
  options?: RingBufferOptions,
): TelemetrySetupResult {
  const resource = createVortexResource(processName, VORTEX_VERSION, {
    "process.pid": process.pid,
  });

  const exporter = new OTLPTraceExporter({
    url: OTLP_ENDPOINT,
    headers: OTLP_HEADERS,
  });

  const processor = new RingBufferSpanProcessor({
    ...options,
    onExportSpans: (spans) => {
      if (!telemetryExportEnabled) return;
      exporter.export(spans, () => {});
    },
  });
  processorSingleton = processor;
  resourceSingleton = resource;

  const provider = new BasicTracerProvider({
    resource,
    spanProcessors: [processor],
  });
  provider.register({
    contextManager: new AsyncLocalStorageContextManager(),
  });

  // Bluebird bypasses V8's PromiseHook API, so AsyncLocalStorage can't
  // track context across Bluebird .then() chains. Patch .then() to capture
  // the active OTel context at registration time and restore it per-callback.
  patchBluebirdContext();

  return { provider, processor };
}

/**
 * Get the RingBufferSpanProcessor for this process.
 * Returns undefined if telemetry hasn't been initialized yet.
 */
export function getProcessor(): RingBufferSpanProcessor | undefined {
  return processorSingleton;
}

/**
 * Get a tracer scoped to a Vortex subsystem.
 * Convention: use dotted names like 'vortex.mod-management', 'vortex.downloads'.
 */
export function getTracer(name: string) {
  return trace.getTracer(name);
}
