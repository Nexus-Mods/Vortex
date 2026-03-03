import type { Span } from "@opentelemetry/api";

import { SpanStatusCode } from "@opentelemetry/api";

import { computeErrorFingerprint } from "../errors";

/**
 * Record an error on a span: compute fingerprint, record the exception,
 * and set ERROR status. Optionally attach extra attributes and
 * ambient context entries (prefixed with `context.`).
 */
export const recordErrorOnSpan = (
  span: Span,
  error: Error,
  appVersion: string,
  context?: Record<string, string>,
  attributes?: Record<string, string | number | boolean>,
): void => {
  if (attributes !== undefined) {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
  }

  if (context !== undefined) {
    for (const [key, value] of Object.entries(context)) {
      span.setAttribute(`context.${key}`, value);
    }
  }

  const fingerprint = computeErrorFingerprint(error.stack, appVersion);
  if (fingerprint !== undefined) {
    span.setAttribute("error.fingerprint", fingerprint);
  }

  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
};
