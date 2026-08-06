import type { ResolvedEndpoint } from "@vortex/shared/download";
import { DownloadError } from "@vortex/shared/errors";
import { TimeoutError, HTTPError, RequestError } from "got";

export function toNetworkError(endpoint: URL | ResolvedEndpoint, err: unknown): DownloadError {
  const url = endpoint instanceof URL ? endpoint : endpoint.url;

  if (err instanceof DownloadError) return err;
  if (err instanceof TimeoutError)
    return new DownloadError({ code: "network-timeout", url }, "Request timed out", err);
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
    return new DownloadError({ code: "network-error", url }, "Network request failed", err);
  return new DownloadError({ code: "network-error", url }, "Unknown network error", err);
}
