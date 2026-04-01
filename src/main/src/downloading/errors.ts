import { TimeoutError, HTTPError, RequestError, AbortError } from "got";

export type DownloadErrorPayload =
  | { code: "cancellation" }
  | { code: "network-error"; url: URL }
  | { code: "network-timeout"; url: URL }
  | { code: "network-bad-status"; url: URL; statusCode: number }
  | { code: "precondition-failed"; url: URL }
  | { code: "fs-error"; path: string }
  | { code: "resolver-error" };

export class DownloadError extends Error {
  readonly payload: DownloadErrorPayload;

  constructor(payload: DownloadErrorPayload, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "DownloadError";
    this.payload = payload;
  }

  public get code(): DownloadErrorPayload["code"] {
    return this.payload.code;
  }
}

export function isCancellation(err: unknown): boolean {
  // NOTE(erri120): The `got` package throws a custom `AbortError` class on cancellation
  if (err instanceof AbortError) return true;

  // NOTE(erri120): The `p-queue` package and anything else using `AbortController`
  // throw a `DOMException` with `name = "AbortError` instead.
  return err instanceof DOMException && err.name === "AbortError";
}

export function toNetworkError(url: URL, err: unknown): DownloadError {
  if (err instanceof DownloadError) return err;
  if (err instanceof TimeoutError)
    return new DownloadError(
      { code: "network-timeout", url },
      "Request timed out",
      err,
    );
  if (err instanceof HTTPError) {
    if (err.response.statusCode === 412) {
      return new DownloadError(
        { code: "precondition-failed", url },
        `Server returned 412 Precondition Failed due to a resource change`,
        err,
      );
    }

    return new DownloadError(
      { code: "network-bad-status", url, statusCode: err.response.statusCode },
      `Server returned ${err.response.statusCode}`,
      err,
    );
  }
  if (err instanceof RequestError)
    return new DownloadError(
      { code: "network-error", url },
      "Network request failed",
      err,
    );
  return new DownloadError(
    { code: "network-error", url },
    "Unknown network error",
    err,
  );
}
