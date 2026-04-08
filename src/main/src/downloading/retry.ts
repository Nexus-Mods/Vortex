import { HTTPError } from "got";

import { DownloadError } from "./errors";

/** The verdict returned by a {@link RetryStrategy}. */
export type RetryVerdict = { retry: true; delayMs: number } | { retry: false };

/** Context passed to the retry strategy for each failure. */
export type RetryContext = {
  /** Which attempt just failed (1-based: 1 = first failure, 2 = second, etc.) */
  attempt: number;
  /** The error from the failed attempt. */
  error: Error;
};

/**
 * Decides whether a failed chunk should be retried and how long to wait.
 * Returning `{ retry: false }` stops retrying and lets the error propagate.
 */
export type RetryStrategy = (context: RetryContext) => RetryVerdict;

/**
 * Creates a retry strategy with exponential backoff and jitter.
 */
export function defaultRetryStrategy(
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30_000,
): RetryStrategy {
  const retryableErrorCodes = new Set([
    // Connection timed out (POSIX.1-2001).
    "ETIMEDOUT",
    // Connection reset (POSIX.1-2001).
    "ECONNRESET",
    // Connection refused (POSIX.1-2001).
    "ECONNREFUSED",
    // Broken pipe (POSIX.1-2001).
    "EPIPE",
    // Network unreachable (POSIX.1-2001).
    "ENETUNREACH",
  ]);

  const retryableStatusCodes = new Set([
    // Request Timeout
    408,
    // Too Many Requests
    429,
    // Internal Server Error
    500,
    // Bad Gateway
    502,
    // Service Unavailable
    503,
    // Gateway Timeout
    504,
  ]);

  return ({ attempt, error }: RetryContext): RetryVerdict => {
    if (attempt > maxRetries) return { retry: false };
    if (!isRetryableError(error, retryableErrorCodes, retryableStatusCodes)) {
      return { retry: false };
    }

    const jitter = Math.floor(Math.random() * 200) - 100;
    const delay = Math.min(
      baseDelayMs * 2 ** (attempt - 1) + jitter,
      maxDelayMs,
    );

    return { retry: true, delayMs: delay };
  };
}

/** A retry strategy that never retries. */
export const noRetry: RetryStrategy = () => ({ retry: false });

function isRetryableError(
  err: Error,
  codes: Set<string>,
  statusCodes: Set<number>,
): boolean {
  if (err instanceof DownloadError) {
    if (
      err.code === "fs-error" ||
      err.code === "protocol-violation" ||
      err.code === "cancellation"
    ) {
      return false;
    }

    // For resolver or network errors, inspect the cause
    return err.cause instanceof Error
      ? isRetryableError(err.cause, codes, statusCodes)
      : false;
  }

  if (err instanceof HTTPError) {
    if (statusCodes.has(err.response.statusCode)) {
      return true;
    }
  }

  if ("code" in err && typeof err.code === "string") {
    return codes.has(err.code);
  }

  return false;
}

/**
 * Abort-aware sleep. Resolves after `ms` milliseconds, or rejects
 * immediately if the signal is already aborted or becomes aborted
 * during the wait.
 */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException("Aborted", "AbortError"),
      );
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException("Aborted", "AbortError"),
      );
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
