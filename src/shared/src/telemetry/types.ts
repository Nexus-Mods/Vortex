import type { Attributes } from "@opentelemetry/api";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { Resource } from "@opentelemetry/resources";

/** Serializable span representation for IPC transport.
 * ReadableSpan has a spanContext() method which cannot be structured-cloned,
 * so we flatten it into plain data. */
export interface SerializedSpan {
  name: string;
  kind: number;
  traceId: string;
  spanId: string;
  traceFlags: number;
  parentSpanId?: string;
  startTime: [number, number];
  endTime: [number, number];
  status: { code: number; message?: string };
  attributes: Record<string, unknown>;
  links: Array<{
    context: { traceId: string; spanId: string; traceFlags: number };
    attributes?: Record<string, unknown>;
  }>;
  events: Array<{
    name: string;
    time: [number, number];
    attributes?: Record<string, unknown>;
  }>;
  duration: [number, number];
  resource: Record<string, unknown>;
  instrumentationLibrary: {
    name: string;
    version?: string;
    schemaUrl?: string;
  };
  droppedAttributesCount: number;
  droppedEventsCount: number;
  droppedLinksCount: number;
}

/** Convert a ReadableSpan into plain serializable data for IPC. */
export function serializeSpan(span: ReadableSpan): SerializedSpan {
  const ctx = span.spanContext();
  return {
    name: span.name,
    kind: span.kind,
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    traceFlags: ctx.traceFlags,
    parentSpanId: span.parentSpanId,
    startTime: span.startTime as [number, number],
    endTime: span.endTime as [number, number],
    status: { code: span.status.code, message: span.status.message },
    attributes: { ...span.attributes },
    links: span.links.map((link) => ({
      context: {
        traceId: link.context.traceId,
        spanId: link.context.spanId,
        traceFlags: link.context.traceFlags,
      },
      attributes: link.attributes ? { ...link.attributes } : undefined,
    })),
    events: span.events.map((event) => ({
      name: event.name,
      time: event.time as [number, number],
      attributes: event.attributes ? { ...event.attributes } : undefined,
    })),
    duration: span.duration as [number, number],
    resource: { ...span.resource.attributes },
    instrumentationLibrary: {
      name: span.instrumentationLibrary.name,
      version: span.instrumentationLibrary.version,
      schemaUrl: span.instrumentationLibrary.schemaUrl,
    },
    droppedAttributesCount: span.droppedAttributesCount,
    droppedEventsCount: span.droppedEventsCount,
    droppedLinksCount: span.droppedLinksCount,
  };
}

/** Reconstruct a ReadableSpan-compatible object from serialized IPC data. */
export function deserializeSpan(data: SerializedSpan): ReadableSpan {
  return {
    name: data.name,
    kind: data.kind,
    spanContext: () => ({
      traceId: data.traceId,
      spanId: data.spanId,
      traceFlags: data.traceFlags,
    }),
    parentSpanId: data.parentSpanId,
    startTime: data.startTime,
    endTime: data.endTime,
    status: data.status,
    attributes: data.attributes as Attributes,
    links: data.links.map((link) => ({
      context: {
        traceId: link.context.traceId,
        spanId: link.context.spanId,
        traceFlags: link.context.traceFlags,
      },
      attributes: link.attributes as Attributes | undefined,
    })),
    events: data.events.map((event) => ({
      name: event.name,
      time: event.time,
      attributes: event.attributes as Attributes | undefined,
    })),
    duration: data.duration,
    ended: true,
    resource: new Resource(data.resource as Attributes),
    instrumentationLibrary: data.instrumentationLibrary,
    droppedAttributesCount: data.droppedAttributesCount,
    droppedEventsCount: data.droppedEventsCount,
    droppedLinksCount: data.droppedLinksCount,
  };
}
