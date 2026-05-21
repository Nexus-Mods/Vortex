import type { Context } from "@opentelemetry/api";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import type { ReadableSpan, Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { serializeSpan } from "@vortex/shared/telemetry";

import { log } from "../logging";
import { patchBluebirdContext } from "./bluebird-patch";
import { createRendererResource } from "./resources";

/**
 * A minimal SpanProcessor that forwards every completed span to the main
 * process via IPC. The main process handles buffering, error detection,
 * and OTLP export via its own RingBufferSpanProcessor.
 */
class ForwardingSpanProcessor implements SpanProcessor {
  onStart(_span: Span, _parentContext: Context): void {}

  onEnd(span: ReadableSpan): void {
    window.api.telemetry.forwardSpan(serializeSpan(span));
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Create and register the renderer-process TracerProvider.
 * Call once early in renderer startup, before extensions load.
 */
export const createRendererTelemetryProvider = async (): Promise<void> => {
  // Check if preload API is available
  if (typeof window === "undefined" || !window.api?.persist) {
    log("warn", "Preload API not available, telemetry will be disabled");
    return;
  }

  try {
    const version = await window.api.app.getVersion();
    const resource = createRendererResource(version);

    const provider = new BasicTracerProvider({
      resource,
      spanProcessors: [new ForwardingSpanProcessor()],
    });
    provider.register({
      // ZoneContextManager (Zone.js) tracks async context entirely in
      // userland — it patches Promise/setTimeout/microtasks/etc. and does
      // not touch Node async hooks. AsyncLocalStorageContextManager crashes
      // in the renderer under Node 24 because V8's AsyncContextFrame and
      // Chromium fight over the `continuationPreservedEmbedderData` slot.
      // Zone.js sidesteps that and stays valid when Node integration is
      // eventually removed from the renderer.
      contextManager: new ZoneContextManager(),
    });

    // Bluebird bypasses the global Promise prototype that Zone.js patches,
    // so cross-bluebird `.then()` boundaries still need an explicit hop.
    patchBluebirdContext();
  } catch (err) {
    log("error", "Failed to create renderer telemetry provider", {
      error: err,
    });
  }
};
