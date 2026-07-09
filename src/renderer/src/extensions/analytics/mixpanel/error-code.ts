import { getErrorCode } from "@vortex/shared";
import { DownloadError, isErrorOfType } from "@vortex/shared/errors";

/**
 * Stable, low-cardinality tokens for the analytics `error_code` property.
 *
 * A DownloadError carries an explicit sub-code; any other error is reduced to a
 * snake_case token derived from its class name (the name survives the IPC
 * boundary, where a rehydrated error loses its prototype but keeps its name).
 * A raw OS/Node `code` is passed through lowercased only as a last resort — we
 * don't normalize or map it (that's the typed-error layer's job), we just avoid
 * discarding the one signal a bare errno Error carries.
 */

/**
 * DownloadError payload code -> token. This is a deliberate mapping, not a
 * mechanical kebab->snake rename: it exists to keep one failure cause reporting
 * one token no matter how it reached us. So it collapses related codes into a
 * shared bucket (`protocol-violation` + `network-error` -> `network_error`) and
 * names codes to match the tokens the class-name path produces for the same
 * failure (`cancellation` -> `user_canceled`, `network-bad-status` ->
 * `http_error`), so a live sub-code and its IPC-rehydrated concrete class don't
 * fork the funnel. `satisfies` keeps it exhaustive: adding a DownloadErrorPayload
 * code without a token here is a build error.
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

function downloadCodeToken(code: unknown): string {
  const map: Record<string, string> = DOWNLOAD_CODE_MAP;
  return typeof code === "string" && map[code] !== undefined ? map[code] : "network_error";
}

/** PascalCase class name -> snake_case token (UserCanceled -> user_canceled). */
function errorNameToToken(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/** Maps an arbitrary caught value to a stable analytics error code. */
export function classifyErrorCode(err: unknown): string {
  if (!(err instanceof Error)) {
    return "unknown_error";
  }
  if (isErrorOfType(err, DownloadError)) {
    return downloadCodeToken(err.payload?.code);
  }
  if (err.name && err.name !== "Error") {
    return errorNameToToken(err.name);
  }
  // TODO: replace this lowercased passthrough with the project-wide node-error
  // classification once it exists — that consolidated typed taxonomy should own
  // turning raw errno codes into stable tokens, not this analytics-only stopgap.
  const nodeCode = getErrorCode(err);
  if (nodeCode != null) {
    return nodeCode.toLowerCase();
  }
  return "unknown_error";
}
