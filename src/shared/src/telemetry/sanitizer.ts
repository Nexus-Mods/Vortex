import type { Attributes, AttributeValue } from "@opentelemetry/api";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { ReadableSpan, SpanExporter, TimedEvent } from "@opentelemetry/sdk-trace-base";

import { sanitizeFramePath } from "../errors";

/**
 * Privacy sanitiser for OpenTelemetry spans.
 *
 * Error traces are exported even without explicit user consent, so the payload
 * must be free of anything that could identify a user or their machine. The
 * sanitiser runs at the export boundary (see {@link SanitizingSpanExporter}), so
 * it covers main-process spans, renderer-forwarded spans and the crash reporter
 * alike, regardless of how their attributes were set upstream.
 *
 * It has two modes, chosen per export by consent:
 *
 *   - **strict** (no consent) — deny-by-default: only explicitly allow-listed
 *     attributes survive, everything else is dropped; counts are bucketed; span
 *     events are reduced to the standard `exception` fields. New attributes
 *     added anywhere in the codebase are excluded until consciously added here.
 *   - **baseline** (consent given) — the richer payload: all attributes and
 *     events are kept, exact counts included.
 *
 * Both modes always run string values through {@link sanitizeFramePath} (strips
 * install prefixes, redacts the OS username) and tokenise well-known folders
 * (C:\Program Files → programfiles:/). Username/path redaction is baseline GDPR
 * minimisation and is never gated on consent. The resource is always reduced to
 * its allow-list (process metadata only — never hostnames or usernames),
 * regardless of consent.
 */

/** Resource attributes permitted to leave the process. Everything the
 *  Vortex resource sets (see telemetry/resources.ts) and nothing host- or
 *  user-identifying (hostnames, usernames). */
export const RESOURCE_ATTRIBUTE_ALLOWLIST: ReadonlySet<string> = new Set([
  "service.name",
  "service.version",
  "process.type",
  "process.pid",
  "deployment.environment",
  "os.type",
  "os.version",
  "host.arch",
  // Auto-added by the OTel SDK; non-identifying metadata.
  "telemetry.sdk.name",
  "telemetry.sdk.version",
  "telemetry.sdk.language",
]);

/** Span attributes permitted to leave the process verbatim (after string
 *  sanitisation). Keys not listed here — and not in {@link BUCKETED_ATTRIBUTES}
 *  — are dropped. */
export const SPAN_ATTRIBUTE_ALLOWLIST: ReadonlySet<string> = new Set([
  // Fault classification
  "error.fingerprint",
  "error.title",
  "error.code",
  "error.message",
  "error.isCommunityExtension",
  "componentStack",
  "crash.type",
  "crash.sourceProcess",
  // Ambient context (setErrorContext) — active game, extension + deployment context
  "context.gamemode",
  "context.extension_type",
  "context.extension_version",
  "context.deployment_method",
  "context.update_channel",
  // Deployment context
  "deployment.gameId",
  "deployment.typeId",
  "deployment.method",
  "deployment.isUnmanaging",
  "deployment.manual",
  // Profile context (opaque ids + active game)
  "profile.from",
  "profile.to",
  "profile.gameId",
  // Extension context
  "extension.name",
  "extension.type",
  // Mod install context — public Nexus ids only, never local names/paths/choices
  "mod.installGameId",
  "mod.installerId",
  "mod.modType",
  "mod.numericModId",
  "mod.fileId",
  "mod.hasPatches",
  "mod.hasFileList",
]);

/** Numeric attributes that must be reported as a coarse range rather than an
 *  exact value, so the count can't become a fingerprint. Values may arrive as
 *  numbers or numeric strings. */
export const BUCKETED_ATTRIBUTES: ReadonlySet<string> = new Set([
  "context.mod_count",
  "context.active_downloads",
  "deployment.modCount",
  "mod.fileCount",
]);

/** Attributes allowed on `exception` span events (recordException output). */
const EXCEPTION_EVENT_ATTRIBUTE_ALLOWLIST: ReadonlySet<string> = new Set([
  "exception.type",
  "exception.message",
  "exception.stacktrace",
  "exception.escaped",
]);

const BUCKET_SIZE = 50;

/**
 * Reduce an exact count to a coarse range so it can't fingerprint a user.
 */
export const bucketCount = (value: number | string): string => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return "unknown";
  const floored = Math.floor(n);
  if (floored <= BUCKET_SIZE) return `0-${BUCKET_SIZE}`;
  const upper = Math.ceil(floored / BUCKET_SIZE) * BUCKET_SIZE;
  return `${upper - BUCKET_SIZE + 1}-${upper}`;
};

/** Well-known Windows folders, tokenised so the path stays diagnostic without
 *  revealing the drive layout. Applied after backslashes are normalised to
 *  forward slashes by {@link sanitizeFramePath}. Longest match first. */
const KNOWN_PATH_TOKENS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[A-Za-z]:\/Program Files \(x86\)/gi, "programfiles86:/"],
  [/[A-Za-z]:\/Program Files/gi, "programfiles:/"],
  [/[A-Za-z]:\/ProgramData/gi, "programdata:/"],
];

const tokenizeWellKnownPaths = (text: string): string =>
  KNOWN_PATH_TOKENS.reduce((acc, [re, token]) => acc.replace(re, token), text);

/** Strip install prefixes + OS username, then tokenise well-known folders. */
const sanitizeText = (text: string): string => tokenizeWellKnownPaths(sanitizeFramePath(text));

const sanitizeValue = (value: AttributeValue): AttributeValue =>
  typeof value === "string" ? sanitizeText(value) : value;

/**
 * Process span attributes. In `strict` mode (no consent) only allow-listed keys
 * survive and counts are bucketed; otherwise all keys are kept. String values
 * are always sanitised regardless of mode.
 */
export const sanitizeSpanAttributes = (attributes: Attributes, strict = true): Attributes => {
  const out: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) continue;
    if (strict && BUCKETED_ATTRIBUTES.has(key)) {
      out[key] = bucketCount(typeof value === "number" ? value : String(value));
    } else if (!strict || SPAN_ATTRIBUTE_ALLOWLIST.has(key)) {
      out[key] = sanitizeValue(value);
    }
    // strict + not allow-listed: dropped
  }
  return out;
};

/** Apply the resource allow-list: drop unknown keys, sanitise text. */
export const sanitizeResourceAttributes = (attributes: Attributes): Attributes => {
  const out: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) continue;
    if (RESOURCE_ATTRIBUTE_ALLOWLIST.has(key)) {
      out[key] = sanitizeValue(value);
    }
  }
  return out;
};

/**
 * Process span events. In `strict` mode (no consent) only `exception` events
 * survive, reduced to the standard allow-listed fields; otherwise all events are
 * kept. Event attribute string values are always sanitised.
 */
const sanitizeEvents = (events: readonly TimedEvent[], strict: boolean): TimedEvent[] =>
  events
    .filter((event) => !strict || event.name === "exception")
    .map((event) => {
      const attributes: Attributes = {};
      for (const [key, value] of Object.entries(event.attributes ?? {})) {
        if (value === undefined) continue;
        if (!strict || EXCEPTION_EVENT_ATTRIBUTE_ALLOWLIST.has(key)) {
          attributes[key] = sanitizeValue(value);
        }
      }
      return { name: event.name, time: event.time, attributes };
    });

/**
 * Produce a privacy-sanitised copy of a span. The original is never mutated.
 * Span/parent context, timing and instrumentation scope are preserved as-is;
 * only attributes, resource, status message, events and link attributes are
 * filtered. Mirrors the hand-built ReadableSpan shape used by deserializeSpan.
 *
 * `strict` (default) enforces the no-consent allow-list; pass `false` once
 * consent is established to keep the richer payload (string redaction stays on).
 */
export const sanitizeSpan = (span: ReadableSpan, strict = true): ReadableSpan => {
  const ctx = span.spanContext();
  return {
    name: span.name,
    kind: span.kind,
    spanContext: () => ctx,
    parentSpanContext: span.parentSpanContext,
    startTime: span.startTime,
    endTime: span.endTime,
    status:
      span.status.message !== undefined
        ? { code: span.status.code, message: sanitizeText(span.status.message) }
        : span.status,
    attributes: sanitizeSpanAttributes(span.attributes, strict),
    links: span.links.map((link) => ({
      context: link.context,
      attributes: link.attributes ? sanitizeSpanAttributes(link.attributes, strict) : undefined,
    })),
    events: sanitizeEvents(span.events, strict),
    duration: span.duration,
    ended: span.ended,
    resource: resourceFromAttributes(sanitizeResourceAttributes(span.resource.attributes)),
    instrumentationScope: span.instrumentationScope,
    droppedAttributesCount: span.droppedAttributesCount,
    droppedEventsCount: span.droppedEventsCount,
    droppedLinksCount: span.droppedLinksCount,
  };
};

/**
 * A SpanExporter decorator that privacy-sanitises every span before handing it
 * to the wrapped exporter. This is the single enforcement boundary for
 * both the main-process ring buffer and the crash reporter wrap their
 * OTLP exporter with this, so no span reaches the collector un-sanitised.
 *
 * `isConsented` selects the sanitisation mode per export: strict (allow-list)
 * when the user has not consented to analytics, baseline (richer payload, string
 * redaction only) when they have. Omitting it defaults to strict — the safe
 * choice for contexts that can't read consent state (e.g. the crash subprocess).
 */
export class SanitizingSpanExporter implements SpanExporter {
  readonly #inner: SpanExporter;
  readonly #isConsented: () => boolean;

  constructor(inner: SpanExporter, isConsented: () => boolean = () => false) {
    this.#inner = inner;
    this.#isConsented = isConsented;
  }

  export(spans: ReadableSpan[], resultCallback: Parameters<SpanExporter["export"]>[1]): void {
    const strict = !this.#isConsented();
    this.#inner.export(
      spans.map((span) => sanitizeSpan(span, strict)),
      resultCallback,
    );
  }

  shutdown(): Promise<void> {
    return this.#inner.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.#inner.forceFlush?.() ?? Promise.resolve();
  }
}
