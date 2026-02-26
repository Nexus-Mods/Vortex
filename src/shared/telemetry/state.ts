import { trace } from "@opentelemetry/api";

import type { RingBufferSpanProcessor } from "./RingBufferSpanProcessor";

/** Process-level singleton reference to the span processor. */
let processorSingleton: RingBufferSpanProcessor | undefined;

/** Whether telemetry export is enabled (controlled by analytics opt-in). */
let telemetryExportEnabled = false;

export function setProcessor(processor: RingBufferSpanProcessor): void {
  processorSingleton = processor;
}

export function getProcessor(): RingBufferSpanProcessor | undefined {
  return processorSingleton;
}

export function setTelemetryEnabled(enabled: boolean): void {
  telemetryExportEnabled = enabled;
}

export function isTelemetryEnabled(): boolean {
  return telemetryExportEnabled;
}

/**
 * Get a tracer scoped to a Vortex subsystem.
 * Convention: use dotted names like 'vortex.mod-management', 'vortex.downloads'.
 */
export function getTracer(name: string) {
  return trace.getTracer(name);
}
