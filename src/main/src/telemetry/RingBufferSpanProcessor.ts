import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";

/** SpanStatusCode.ERROR from @opentelemetry/api (value import not allowed in shared/) */
const SPAN_STATUS_ERROR = 2;

export interface RingBufferOptions {
  /** Maximum number of completed spans to retain. Default: 500 */
  maxSpans?: number;
  /** Called when spans from an error trace need to be exported. Fire-and-forget. */
  onExportSpans?: (spans: ReadableSpan[]) => void;
}

const DEFAULT_MAX_SPANS = 500;
const MAX_EXPORTED_TRACE_IDS = 1000;

/**
 * A SpanProcessor that stores finished spans in a fixed-size circular buffer.
 * When a span ends with ERROR status, the processor immediately collects all
 * spans sharing the same traceId and invokes the `onExportSpans` callback.
 * Spans arriving after the initial export (late-arriving children) are
 * exported immediately without buffering.
 *
 * Non-error traces are never exported — they stay in the buffer until
 * overwritten or used by the crash-reporting path.
 *
 * Also tracks in-flight (started but not yet ended) spans to identify
 * operations that were interrupted by a crash.
 */
export class RingBufferSpanProcessor implements SpanProcessor {
  readonly #buffer: (ReadableSpan | undefined)[];
  #head: number = 0;
  #count: number = 0;
  readonly #maxSpans: number;
  readonly #onExportSpans?: RingBufferOptions["onExportSpans"];

  /** TraceIds already exported — late-arriving spans are exported immediately */
  readonly #exportedTraceIds = new Set<string>();

  /** Spans that have been started but not yet ended */
  readonly #inFlight = new Map<string, Span>();

  constructor(options: RingBufferOptions = {}) {
    this.#maxSpans = options.maxSpans ?? DEFAULT_MAX_SPANS;
    this.#buffer = new Array<ReadableSpan | undefined>(this.#maxSpans).fill(
      undefined,
    );
    this.#onExportSpans = options.onExportSpans;
  }

  onStart(span: Span, _parentContext: Context): void {
    this.#inFlight.set(span.spanContext().spanId, span);
  }

  onEnd(span: ReadableSpan): void {
    this.#inFlight.delete(span.spanContext().spanId);

    const traceId = span.spanContext().traceId;

    // Trace already exported — send this late-arriving span immediately
    if (this.#exportedTraceIds.has(traceId)) {
      this.#exportSpans([span]);
      return;
    }

    // Add to ring buffer
    this.#buffer[this.#head] = span;
    this.#head = (this.#head + 1) % this.#maxSpans;
    this.#count = Math.min(this.#count + 1, this.#maxSpans);

    // Error span — export the entire trace
    if ((span.status.code as number) === SPAN_STATUS_ERROR) {
      this.#markTraceExported(traceId);
      this.#exportSpans(this.#takeSpansByTraceId(traceId));
    }
  }

  /** Return all buffered (completed) spans in chronological order */
  getBufferedSpans(): ReadableSpan[] {
    if (this.#count === 0) return [];

    const raw =
      this.#count < this.#maxSpans
        ? this.#buffer.slice(0, this.#count)
        : [
          ...this.#buffer.slice(this.#head),
          ...this.#buffer.slice(0, this.#head),
        ];

    return raw.filter((s): s is ReadableSpan => s !== undefined);
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    this.#buffer.fill(undefined);
    this.#head = 0;
    this.#count = 0;
    this.#inFlight.clear();
    this.#exportedTraceIds.clear();
    return Promise.resolve();
  }

  /** Fire-and-forget export via the callback. Never throws. */
  #exportSpans(spans: ReadableSpan[]): void {
    if (this.#onExportSpans === undefined || spans.length === 0) return;
    try {
      this.#onExportSpans(spans);
    } catch {
      // Never let callback errors break the processor
    }
  }

  #markTraceExported(traceId: string): void {
    this.#exportedTraceIds.add(traceId);
    if (this.#exportedTraceIds.size > MAX_EXPORTED_TRACE_IDS) {
      const next = this.#exportedTraceIds.values().next() as IteratorResult<string, never>;
      if (!next.done) {
        this.#exportedTraceIds.delete(next.value);
      }
    }
  }

  /**
   * Remove and return all buffered spans with the given traceId.
   * Exported spans are removed from the ring buffer so they won't
   * appear in subsequent exports or crash reports.
   */
  #takeSpansByTraceId(traceId: string): ReadableSpan[] {
    const result: ReadableSpan[] = [];
    for (let i = 0; i < this.#buffer.length; i++) {
      const s = this.#buffer[i];
      if (s !== undefined && s.spanContext().traceId === traceId) {
        result.push(s);
        this.#buffer[i] = undefined;
      }
    }
    return result.sort(byStartTime);
  }
}

const byStartTime = (a: ReadableSpan, b: ReadableSpan): number => {
  const [aSec, aNano] = a.startTime;
  const [bSec, bNano] = b.startTime;
  return aSec !== bSec ? aSec - bSec : aNano - bNano;
};
