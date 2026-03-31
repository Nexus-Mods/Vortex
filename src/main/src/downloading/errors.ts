import { TimeoutError, HTTPError, RequestError } from "got";

export type DownloadErrorPayload =
  | { code: "network-error"; url: URL }
  | { code: "network-timeout"; url: URL }
  | { code: "network-bad-status"; url: URL; statusCode: number }
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

export function toNetworkError(url: URL, err: unknown): DownloadError {
  if (err instanceof DownloadError) return err;
  if (err instanceof TimeoutError)
    return new DownloadError(
      { code: "network-timeout", url },
      "Request timed out",
      err,
    );
  if (err instanceof HTTPError)
    return new DownloadError(
      { code: "network-bad-status", url, statusCode: err.response.statusCode },
      `Server returned ${err.response.statusCode}`,
      err,
    );
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
