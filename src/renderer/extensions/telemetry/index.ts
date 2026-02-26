import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";

import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { Resource } from "@opentelemetry/resources";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";

import { patchBluebirdContext } from "../../../shared/telemetry/bluebird-patch";
import { serializeSpan } from "../../../shared/telemetry/types";

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

function init(): boolean {
  const resource = new Resource({
    "service.name": "vortex",
    "process.type": "renderer",
  });

  const provider = new BasicTracerProvider({
    resource,
    spanProcessors: [new ForwardingSpanProcessor()],
  });
  provider.register({
    // TODO: Switch to ZoneContextManager when Node.js is removed from renderer
    contextManager: new AsyncLocalStorageContextManager(),
  });

  patchBluebirdContext();

  return true;
}

export default init;
