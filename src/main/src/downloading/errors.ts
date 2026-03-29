import { TimeoutError, HTTPError, RequestError } from "got";

export type DownloadErrorCode =
  | "network-error"
  | "network-timeout"
  | "network-bad-status"
  | "fs-error"
  | "resolver-error";

export class DownloadError extends Error {
  #code: DownloadErrorCode;

  constructor(code: DownloadErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "DownloadError";
    this.#code = code;
  }

  public get code(): DownloadErrorCode {
    return this.#code;
  }
}

export function toNetworkError(err: unknown): DownloadError {
  if (err instanceof TimeoutError)
    return new DownloadError("network-timeout", "Request timed out", err);
  if (err instanceof HTTPError)
    return new DownloadError(
      "network-bad-status",
      `Server returned ${err.response.statusCode}`,
      err,
    );
  if (err instanceof RequestError)
    return new DownloadError("network-error", "Network request failed", err);
  return new DownloadError("network-error", "Unknown network error", err);
}
