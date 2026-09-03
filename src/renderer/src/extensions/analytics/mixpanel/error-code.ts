import { getErrorCode } from "@vortex/shared";
import { type VortexErrorKind, VortexError } from "@vortex/shared/errors";

/**
 * Stable, low-cardinality tokens for the analytics `error_code` property.
 *
 * A VortexError thrown by the downloader carries an explicit `data.kind`;
 * any other error is reduced to a snake_case token derived from its class
 * name. A raw OS/Node `code` is passed through lowercased only as a last
 * resort — we don't normalize or map it (that's the typed-error layer's
 * job), we just avoid discarding the one signal a bare errno Error carries.
 */

/**
 * Download-side VortexError `data.kind` -> token. Deliberate mapping, not a
 * mechanical kebab->snake rename: it collapses related kinds into a shared
 * bucket (`http:protocol-violation` + `http:generic` -> `network_error`) and
 * names kinds to match the tokens the class-name path produces for the same
 * failure (`user-canceled` -> `user_canceled`, `http:bad-status` ->
 * `http_error`), so a live kind and its IPC-rehydrated concrete error don't
 * fork the funnel.
 *
 * The `fs:*` cluster is handled separately below so all FS kinds funnel to
 * `fs_error` without enumerating every variant.
 */
const DOWNLOAD_KIND_MAP: Partial<Record<VortexErrorKind, string>> = {
  "user-canceled": "user_canceled",
  "http:generic": "network_error",
  "http:timeout": "timeout",
  "http:bad-status": "http_error",
  "http:precondition-failed": "precondition_failed",
  "http:protocol-violation": "network_error",
  "download:is-html": "download_is_html",
  "download:resolver-error": "resolver_error",
};

function downloadKindToken(kind: VortexErrorKind): string {
  if (kind.startsWith("fs:")) return "fs_error";
  return DOWNLOAD_KIND_MAP[kind] ?? "network_error";
}

/**
 * Whether a {@link VortexErrorKind} is one the download layer can produce. The
 * kind drives a different UI flow only for these; other VortexError kinds
 * (data-invalid, process-canceled, etc.) are best classified by their class
 * name instead of a download token.
 */
function isDownloadSideKind(kind: VortexErrorKind): boolean {
  return (
    kind === "user-canceled" ||
    kind.startsWith("http:") ||
    kind.startsWith("download:") ||
    kind.startsWith("fs:")
  );
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
  // Rehydrated VortexErrors are real VortexError instances — the wire form
  // preserves the kind discriminator on `data.kind`.
  if (err instanceof VortexError) {
    if (err.data.kind !== undefined && isDownloadSideKind(err.data.kind)) {
      return downloadKindToken(err.data.kind);
    }
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
