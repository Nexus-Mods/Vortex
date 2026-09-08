import { VortexError, parseError } from "@vortex/shared";
import type { ResolvedEndpoint } from "@vortex/shared/download";
import { HTTPError, RequestError, TimeoutError } from "got";

/**
 * Classifies an error thrown by the downloader network code path into the
 * matching `http:*` {@link VortexError} kind. Anything we can't pin down is
 * funnelled through {@link parseError} so the same Node/POSIX classification
 * the FS backend uses drives the network fallback (network POSIX codes with
 * a URL context collapse to `http:generic`, everything else to `os:generic`
 * or `unknown`).
 */
export function toNetworkError(endpoint: URL | ResolvedEndpoint, err: unknown): VortexError {
  const url = endpoint instanceof URL ? endpoint : endpoint.url;
  const urlString = url.toString();

  if (err instanceof TimeoutError) {
    return new VortexError(
      "Request timed out",
      { kind: "http:timeout", url: urlString },
      { cause: err },
    );
  }

  if (err instanceof HTTPError) {
    if (err.response.statusCode === 412) {
      return new VortexError(
        "Server returned 412 Precondition Failed due to a resource change",
        { kind: "http:precondition-failed", url: urlString },
        { cause: err },
      );
    }

    return new VortexError(
      `Server returned ${err.response.statusCode}`,
      { kind: "http:bad-status", url: urlString, statusCode: err.response.statusCode },
      { cause: err },
    );
  }

  if (err instanceof RequestError) {
    const parsed = parseError(err, { url: urlString }, ({ data, isTransient }) =>
      data.kind === "http:generic" || data.kind === "os:generic"
        ? `Network request failed${isTransient ? " (transient)" : ""}`
        : undefined,
    );
    if (parsed.data.kind !== "unknown") return parsed;

    // got's own codes (ERR_READING_RESPONSE_STREAM, ...) have no POSIX mapping; the retry
    // strategy decides by `originalCode`
    return new VortexError(
      "Network request failed",
      { kind: "http:generic", url: urlString, originalCode: err.code },
      { cause: err },
    );
  }

  return parseError(err, { url: urlString });
}
