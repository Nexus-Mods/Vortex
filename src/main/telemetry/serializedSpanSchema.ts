import type { SerializedSpan } from "@vortex/shared/telemetry";

import { z } from "zod";

// z.tuple infers a wider _output type in Zod v4; cast to the known-correct type.
const HrTime = z.tuple([z.number(), z.number()]) as unknown as z.ZodType<[number, number]>;
const AttrsSchema = z.record(z.string(), z.unknown());
const SpanContextSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  traceFlags: z.number(),
});

/** Zod schema for {@link SerializedSpan}, used to validate untrusted IPC data.
 * Typed as z.ZodType<SerializedSpan> so TypeScript enforces the schema stays
 * in sync with the interface — a field mismatch is a compile error. */
export const SerializedSpanSchema: z.ZodType<SerializedSpan> = z.object({
  name: z.string(),
  kind: z.number(),
  traceId: z.string(),
  spanId: z.string(),
  traceFlags: z.number(),
  parentSpanId: z.string().optional(),
  startTime: HrTime,
  endTime: HrTime,
  status: z.object({ code: z.number(), message: z.string().optional() }),
  attributes: AttrsSchema,
  links: z.array(
    z.object({ context: SpanContextSchema, attributes: AttrsSchema.optional() }),
  ),
  events: z.array(
    z.object({
      name: z.string(),
      time: HrTime,
      attributes: AttrsSchema.optional(),
    }),
  ),
  duration: HrTime,
  resource: AttrsSchema,
  instrumentationLibrary: z.object({
    name: z.string(),
    version: z.string().optional(),
    schemaUrl: z.string().optional(),
  }),
  droppedAttributesCount: z.number(),
  droppedEventsCount: z.number(),
  droppedLinksCount: z.number(),
});
