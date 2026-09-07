import { getErrorCode } from "@vortex/shared";
import { type VortexErrorKind, VortexError } from "@vortex/shared/errors";

/**
 * Stable, low-cardinality tokens for the analytics `error_code` property.
 *
 * Dispatch is on `data.kind`, which is the only part of an error that survives
 * the IPC boundary: main serializes to `SerializedVortexError` and the renderer
 * rebuilds a base VortexError from `data` alone, so the concrete class, the
 * `name` and the Node `code` property are all gone by the time we see it.
 * Anything still classified by class name is therefore renderer-local, and that
 * branch retires with the renderer's VortexError migration.
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
 * Whether a {@link VortexErrorKind} is one the download layer can produce.
 * These are the kinds the collapsing map above is calibrated for; every other
 * kind gets a mechanical token from {@link kindToToken}.
 */
function isDownloadSideKind(kind: VortexErrorKind): boolean {
  return (
    kind === "user-canceled" ||
    kind.startsWith("http:") ||
    kind.startsWith("download:") ||
    kind.startsWith("fs:")
  );
}

/**
 * Kinds the classifier reaches when it could not attribute the failure. The
 * name carries no cause, so the raw OS code is the only signal left.
 */
const CATCH_ALL_KINDS = new Set<VortexErrorKind>(["os:generic", "unknown"]);

/** PascalCase class name -> snake_case token (UserCanceled -> user_canceled). */
function errorNameToToken(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Kind -> snake_case token (`data-invalid` -> `data_invalid`, `os:unsupported`
 * -> `os_unsupported`), chosen to land on the same token the class-name branch
 * produces for the equivalent renderer-local error.
 */
function kindToToken(kind: VortexErrorKind): string {
  return kind.replace(/[:-]/g, "_");
}

function vortexErrorToken(err: VortexError): string {
  const { kind } = err.data;

  if (isDownloadSideKind(kind)) {
    return downloadKindToken(kind);
  }

  if (CATCH_ALL_KINDS.has(kind)) {
    // `code` is not a property of VortexError, so the classifier's copy of the
    // raw errno is the only one that survives serialization.
    const originalCode = "originalCode" in err.data ? err.data.originalCode : undefined;
    if (typeof originalCode === "string" && originalCode.length > 0) {
      return originalCode.toLowerCase();
    }
    return "unknown_error";
  }

  return kindToToken(kind);
}

/** Maps an arbitrary caught value to a stable analytics error code. */
export function classifyErrorCode(err: unknown): string {
  if (!(err instanceof Error)) {
    return "unknown_error";
  }

  if (err instanceof VortexError) {
    return vortexErrorToken(err);
  }

  // Renderer-local errors predating the VortexError migration still carry their
  // class identity. Anything from main was handled above; its `name` would read
  // "VortexError" here, which is no signal at all.
  if (err.name !== "" && err.name !== "Error") {
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
