import { getErrorCode, getErrorNativeCode } from "./errors";
import { DownloadError } from "./types/errors";

/**
 * Stable, low-cardinality error codes for analytics `error_code` properties, so
 * the data team can chart failures by cause. Three sources, in priority order:
 *   - `DownloadError` sub-code: an explicit, exhaustively-checked map (see below).
 *   - Node/OS `err.code`: a small fixed normalization of stable constants; any
 *     other code passes through verbatim (e.g. "ECONNRESET").
 *   - Otherwise the token is DERIVED from the error's class name (which Vortex
 *     typed errors set to `constructor.name`), so new error classes get a code
 *     with no change here (UserCanceled -> user_canceled). Using `name` rather
 *     than `instanceof` also survives the IPC boundary, where a rehydrated error
 *     keeps its name but loses its prototype.
 */

/**
 * DownloadError payload codes -> analytics token. `satisfies` makes this exhaustive: adding a
 * DownloadErrorPayload code without a token here is a build error.
 */
const DOWNLOAD_CODE_MAP = {
  cancellation: "user_canceled",
  "network-error": "network_error",
  "network-timeout": "timeout",
  "network-bad-status": "http_error",
  "precondition-failed": "precondition_failed",
  "protocol-violation": "network_error",
  "is-html": "download_is_html",
  "fs-error": "fs_error",
  "resolver-error": "resolver_error",
} satisfies Record<DownloadError["code"], string>;

/** Stable OS-level Node codes normalized to shared tokens; unmapped codes pass through. */
const NODE_CODE_MAP: Record<string, string> = {
  ENOSPC: "insufficient_disk_space",
  EPERM: "permission_denied",
  EACCES: "permission_denied",
  ENOENT: "file_not_found",
  EBUSY: "file_in_use",
  EROFS: "read_only_filesystem",
};

/** The base Error name carries no cause (its token would be "error"); every other name is useful. */
const GENERIC_ERROR_NAMES = new Set(["Error"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Maps a DownloadError payload code (possibly unknown, from a rehydrated error) to a token. */
function downloadCodeToken(code: unknown): string {
  // Widening view (an annotated assignment, not an `as` cast) so an unknown/rehydrated code
  // string can index the exhaustive map without a narrowing assertion.
  const map: Record<string, string> = DOWNLOAD_CODE_MAP;
  return typeof code === "string" && map[code] !== undefined ? map[code] : "network_error";
}

/** PascalCase / acronym class name -> snake_case token. HTTPError -> http_error. */
export function errorNameToToken(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2") // acronym boundary: HTTPError -> HTTP_Error
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // camel boundary: DiskSpace -> Disk_Space
    .toLowerCase();
}

/**
 * Maps an arbitrary caught value to a stable analytics error code.
 *
 * Complements `prettifyNodeErrorMessage` (user-facing message) and
 * `decodeSystemError` (Windows numeric codes) — neither yields an analytics token.
 */
export function classifyErrorCode(err: unknown): string {
  if (!(err instanceof Error)) {
    return "unknown_error";
  }

  // A live DownloadError carries the richest sub-code via its typed payload.
  if (err instanceof DownloadError) {
    return downloadCodeToken(err.payload?.code);
  }
  // Rehydrated across IPC: the prototype is lost but the name is preserved and the payload is
  // reattached as an own property. Read it through guards (no narrowing cast) as unknown.
  if (err.name === DownloadError.name && isRecord(err)) {
    const payload = err.payload;
    return downloadCodeToken(isRecord(payload) ? payload.code : undefined);
  }

  // A Node/OS code is more specific than the generic "Error" name it rides on.
  const nodeCode = getErrorCode(err);
  if (nodeCode !== null) {
    return NODE_CODE_MAP[nodeCode] ?? nodeCode;
  }

  // Vortex typed errors (and meaningful JS errors like TypeError) -> derived token.
  if (err.name && !GENERIC_ERROR_NAMES.has(err.name)) {
    return errorNameToToken(err.name);
  }

  if (getErrorNativeCode(err) !== null) {
    return "native_error";
  }

  return "unknown_error";
}
