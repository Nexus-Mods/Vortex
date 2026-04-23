import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";

import { log } from "../logging";
import { createVortexResource } from "./resources";
import {
  RingBufferSpanProcessor,
  type RingBufferOptions,
} from "./RingBufferSpanProcessor";
import { isTelemetryEnabled, setProcessor } from "./state";

export const COLLECTOR_URL =
  process.env.VORTEX_COLLECTOR_URL ?? "https://vortex-collector.nexusmods.com";

export const OTLP_HEADERS: Record<string, string> = {};

/**
 * Create and register the main-process TracerProvider.
 * Call once early in main process startup.
 */
export const createMainTelemetryProvider = (
  options?: RingBufferOptions,
): void => {
  const resource = createVortexResource("main");

  const exporter = new OTLPTraceExporter({
    url: `${COLLECTOR_URL}/v1/traces`,
    headers: OTLP_HEADERS,
  });

  const processor = new RingBufferSpanProcessor({
    ...options,
    onExportSpans: (spans) => {
      if (!isTelemetryEnabled()) return;
      exporter.export(spans, (result) => {
        if (result.error) {
          const { message, code } = result.error as Error & {
            code?: string | number;
          };
          log("warn", "OTLP export failed", { message, code });
        }
      });
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
};
