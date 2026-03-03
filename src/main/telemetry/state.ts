import type { SpanProcessor } from "@opentelemetry/sdk-trace-base";

/** Process-level singleton reference to the span processor. */
let processorSingleton: SpanProcessor | undefined;

/** Whether telemetry export is enabled (controlled by analytics opt-in). */
let telemetryExportEnabled = false;

export const setProcessor = (processor: SpanProcessor): void => {
  processorSingleton = processor;
};

export const getProcessor = (): SpanProcessor | undefined => {
  return processorSingleton;
};

export const setTelemetryEnabled = (enabled: boolean): void => {
  telemetryExportEnabled = enabled;
};

export const isTelemetryEnabled = (): boolean => {
  return telemetryExportEnabled;
};
