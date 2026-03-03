import type { Tracer } from "@opentelemetry/api";

import { trace } from "@opentelemetry/api";

import type { RingBufferSpanProcessor } from "./RingBufferSpanProcessor";

/** Process-level singleton reference to the span processor. */
let processorSingleton: RingBufferSpanProcessor | undefined;

/** Whether telemetry export is enabled (controlled by analytics opt-in). */
let telemetryExportEnabled = false;

export const setProcessor = (processor: RingBufferSpanProcessor): void => {
  processorSingleton = processor;
};

export const getProcessor = (): RingBufferSpanProcessor | undefined => {
  return processorSingleton;
};

export const setTelemetryEnabled = (enabled: boolean): void => {
  telemetryExportEnabled = enabled;
};

export const isTelemetryEnabled = (): boolean => {
  return telemetryExportEnabled;
};

/**
 * Get a tracer scoped to a Vortex subsystem.
 * Convention: use dotted names like 'vortex.mod-management', 'vortex.downloads'.
 */
export const getTracer = (name: string): Tracer => {
  return trace.getTracer(name);
};
