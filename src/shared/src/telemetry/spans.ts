import type { Span } from "@opentelemetry/api";

import { SpanStatusCode } from "@opentelemetry/api";

import { computeErrorFingerprint, sanitizeFramePath } from "../errors";

/**
 * Record an error on a span: compute fingerprint, record the exception,
 * and set ERROR status. Optionally attach extra attributes and
 * ambient context entries (prefixed with `context.`).
 *
 * The error's message and stack are passed through `sanitizeFramePath`
 * before being attached, so OS usernames and absolute install paths do
 * not reach the telemetry backend (GDPR Art. 5(1)(c) data minimisation).
 * The caller's Error object is not mutated.
 */
export const recordErrorOnSpan = (
  span: Span,
  error: Error,
  appVersion: string,
  context?: Record<string, string>,
  attributes?: Record<string, string | number | boolean>,
): void => {
  const sanitizedMessage = sanitizeFramePath(error.message);
  const sanitizedStack =
    error.stack !== undefined ? sanitizeFramePath(error.stack) : undefined;
  const sanitized = new Error(sanitizedMessage);
  sanitized.name = error.name;
  sanitized.stack = sanitizedStack;

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

  const fingerprint = computeErrorFingerprint(sanitizedStack, appVersion);
  if (fingerprint !== undefined) {
    span.setAttribute("error.fingerprint", fingerprint);
  }

  span.recordException(sanitized);
  span.setStatus({ code: SpanStatusCode.ERROR, message: sanitizedMessage });
};
