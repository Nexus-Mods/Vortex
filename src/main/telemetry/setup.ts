import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";

import {
  patchBluebirdContext,
  RingBufferSpanProcessor,
  type RingBufferOptions,
  isTelemetryEnabled,
  setProcessor,
} from "@vortex/shared/telemetry";
import { createVortexResource } from "./resources";

export const COLLECTOR_URL =
  process.env.VORTEX_COLLECTOR_URL ?? "https://vortex-collector.nexusmods.com";

export const OTLP_HEADERS: Record<string, string> = {};

/**
 * Create and register the main-process TracerProvider.
 * Call once early in main process startup.
 */
export function createMainTelemetryProvider(
  appVersion: string,
  options?: RingBufferOptions,
): void {
  const resource = createVortexResource("main", appVersion, {
    "process.pid": process.pid,
  });

  const exporter = new OTLPTraceExporter({
    url: `${COLLECTOR_URL}/v1/traces`,
    headers: OTLP_HEADERS,
  });

  const processor = new RingBufferSpanProcessor({
    ...options,
    onExportSpans: (spans) => {
      if (!isTelemetryEnabled()) return;
      exporter.export(spans, () => {});
    },
  });
  setProcessor(processor);

  const provider = new BasicTracerProvider({
    resource,
    spanProcessors: [processor],
  });
  provider.register({
    contextManager: new AsyncLocalStorageContextManager(),
  });

  patchBluebirdContext();
}
