import { CAUSE_SEPARATOR, type VortexErrorKind } from "./errors/base";
import { parseError } from "./errors/parser";

/** Extracts an error message from an unknown value in a catch statement */
export function getErrorMessage(err: unknown): string | null {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  return null;
}

export function getErrorMessageOrDefault(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  return "unknown error";
}

/** Casts or converts the unknown into an Error */
export function unknownToError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }

  if (typeof err === "string") {
    return new Error(err);
  }

  return new Error("unknown error");
}

/** Extracts the code property from a potential error object */
export function getErrorCode(err: unknown): string | null {
  if (!(err instanceof Error)) {
    return null;
  }

  if (!("code" in err)) {
    return null;
  }

  if (typeof err.code !== "string") {
    return null;
  }

  return err.code;
}

/**
 * Extracts the HTTP status code from a potential error object. What carries it
 * varies by source - nexus-api raises both `NexusError` and `HTTPError` with a
 * `statusCode` getter, and Vortex's own `HTTPError` matches them - so read the
 * property rather than test for a class.
 */
export function getErrorStatusCode(err: unknown): number | null {
  if (!(err instanceof Error)) {
    return null;
  }

  if (!("statusCode" in err)) {
    return null;
  }

  if (typeof err.statusCode !== "number") {
    return null;
  }

  return err.statusCode;
}

/**
 * Extracts the native error code from Windows errors.
 * Checks both `nativeCode` and `systemCode` properties that are
 * attached by the native error handling in renderer.tsx.
 */
export function getErrorNativeCode(err: unknown): number | bigint | null {
  if (!(err instanceof Error)) {
    return null;
  }

  if (
    "nativeCode" in err &&
    (typeof err.nativeCode === "number" || typeof err.nativeCode === "bigint")
  ) {
    return err.nativeCode;
  }

  if (
    "systemCode" in err &&
    (typeof err.systemCode === "number" || typeof err.systemCode === "bigint")
  ) {
    return err.systemCode;
  }

  return null;
}

/**
 * Error codes that indicate a user-environment problem (write-protected
 * folder, disk full, file locked by another process) rather than a Vortex
 * bug. Telemetry export filters these out — exporting them spams our error
 * tracking with issues we cannot fix in code.
 */
const ENVIRONMENTAL_ERROR_KINDS = new Set<VortexErrorKind>([
  "fs:no-permissions", // write-protected folder, ACL, or a file held by another process
  "fs:no-space", // disk full
  "fs:read-only", // read-only mount or hardware switch
]);

/**
 * Returns true if the error represents a user-environment problem rather
 * than a Vortex bug. Honors an explicit `allowReport === false` flag set
 * by `prettifyNodeErrorMessage`, falling back to the classified kind.
 *
 * Deliberately keyed on the kind rather than the raw code: the classifier only
 * reaches an `fs:*` verdict when the failure actually names a path, so a bare
 * EPERM/EACCES from `spawn`, `process.kill` or a socket bind stays reportable
 * instead of being written off as the user's environment. Reading the kind also
 * works for an error that crossed IPC, which arrives rebuilt from `data` alone
 * and no longer carries a `code` property.
 */
export function isEnvironmentalError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  if ("allowReport" in err && err.allowReport === false) {
    return true;
  }
  return ENVIRONMENTAL_ERROR_KINDS.has(parseError(err).data.kind);
}

type ErrorWithSystemCode = Error & { systemCode: number | bigint };

/** Extracts the system code property from a potential error object */
export function isErrorWithSystemCode(err: unknown): err is ErrorWithSystemCode {
  if (!(err instanceof Error)) {
    return false;
  }

  if (
    "systemCode" in err &&
    (typeof err.systemCode === "number" || typeof err.systemCode === "bigint")
  )
    return true;

  return false;
}

/**
 * Sanitize paths embedded in a string — stack frames, error messages, or any
 * free-form text that may contain absolute paths. Two passes:
 *
 *   1. Install-prefix strip: when a path reaches a known Vortex anchor (src/,
 *      node_modules/, app.asar, plugins/) everything before the anchor is
 *      dropped, making fingerprints stable across machines.
 *   2. User-home redact: any remaining `C:/Users/<name>/`, `/Users/<name>/`,
 *      or `/home/<name>/` has the username replaced with `<USER>`. This
 *      covers paths with no Vortex anchor (e.g. game install dirs in ENOENT
 *      messages) where we want to keep diagnostic context but not the OS
 *      username — GDPR Art. 5(1)(c) data minimisation.
 *
 * Path separators are normalized to forward slashes.
 *
 * Examples:
 *   "at f (D:\Dev\Vortex\src\foo.ts:1:2)" → "at f (src/foo.ts:1:2)"
 *   "at f (/home/user/Vortex/src/foo.ts:1:2)" → "at f (src/foo.ts:1:2)"
 *   "at f (C:\Program Files\Vortex\resources\app.asar\renderer.js:1:2)" → "at f (app.asar/renderer.js:1:2)"
 *   "at f (D:\Program Files\Vortex\resources\app.asar.unpacked\bundledPlugins\x\index.js:1:2)" → "at f (app.asar.unpacked/bundledPlugins/x/index.js:1:2)"
 *   "at f (C:\Users\user\AppData\Roaming\Vortex\plugins\x\index.js:1:2)" → "at f (plugins/x/index.js:1:2)"
 *   "ENOENT ... 'C:\Users\bob\AppData\Local\Larian\Mods\foo.pak'" → "ENOENT ... 'C:/Users/<USER>/AppData/Local/Larian/Mods/foo.pak'"
 *   "at f (chrome-extension://id/page.js:1:2)" → unchanged
 */
export const sanitizeFramePath = (frame: string): string =>
  frame.replace(INSTALL_PATH_RE, "").replace(/\\/g, "/").replace(USER_HOME_RE, "$1<USER>");

const SEP = String.raw`[/\\]`;
const WIN = String.raw`[A-Za-z]:${SEP}`; // C:\ or C:/
const UNIX = String.raw`(?<!\/)\/`; // / not inside ://
const SEGS = String.raw`(?:[^/\\():]+${SEP})*?`; // lazy path segments
const ANCHORS = String.raw`(?:src|node_modules|app\.asar(?:\.unpacked)?|plugins)`;
/** Matches the installation-specific prefix of a stack frame path up to the first
 * stable segment (src, node_modules, app.asar, or plugins). */
const INSTALL_PATH_RE = new RegExp(String.raw`(?:${WIN}|${UNIX})${SEGS}(?=${ANCHORS}${SEP})`, "g");

/** Matches the username segment of a user-home path (`/Users/<name>` or
 * `/home/<name>`). Run after backslash normalization so only forward slashes
 * need to be considered. The segment runs up to the next `/`, so it captures
 * multi-word Windows account names (`John S. Junior`) — spaces are allowed, but
 * other whitespace (tab/newline) and quotes/`<>` bound it so free text and an
 * already-redacted `<USER>` aren't consumed (the latter keeps it idempotent). */
const USER_HOME_RE = /(\/(?:Users|home)\/)([^/\t\r\n'"<>:|?*]+)/gi;

/** Strips the trailing `:column` from a `:line:col` position, keeping `:line`.
 *  V8 reports the call-site column for each frame, which differs per invocation
 *  even for the same minified line — same function calling out at multiple
 *  sites produces multiple columns. Dropping it groups those together. */
const STRIP_COLUMN_RE = /(:\d+):\d+(?=\)|$)/g;

/** Number of innermost frames hashed for the fingerprint. The deepest frames
 *  carry the throw site and immediate caller; frames further up are calling
 *  context that varies per invocation and prevents grouping. */
const FINGERPRINT_FRAME_LIMIT = 5;

/**
 * Compute a fingerprint from the stack trace call frames and app version.
 * Same error from the same code path in the same version produces the same hash,
 * which can be used for deduplication on the backend.
 *
 * Beyond `sanitizeFramePath`'s install-prefix strip and user-home redact, the
 * fingerprint additionally:
 *   - drops the `:column` from each frame (unstable across builds and call sites),
 *   - keeps only the innermost {@link FINGERPRINT_FRAME_LIMIT} frames (calling
 *     context above the throw site varies per invocation),
 *   - hashes only the wrapped error's section of a chained stack, so the same
 *     throw site groups together whichever classifier wrapped it.
 *
 * An optional `discriminator` distinguishes error sub-types that share an
 * identical stack.
 */
export const computeErrorFingerprint = (
  stack: string | undefined,
  appVersion: string,
  discriminator?: string,
): string | undefined => {
  if (stack === undefined) return undefined;
  // A VortexError's stack ends with the wrapped error's (see CAUSE_SEPARATOR);
  // that last section is the throw site, the ones before it are wrappers.
  const throwSite = stack.split(`\n${CAUSE_SEPARATOR}`).at(-1) ?? stack;
  const frames = throwSite
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .map(sanitizeFramePath)
    .map((f) => f.replace(STRIP_COLUMN_RE, "$1"))
    .slice(0, FINGERPRINT_FRAME_LIMIT);
  if (frames.length === 0) return undefined;
  const input =
    frames.join("\n") +
    "\n" +
    appVersion +
    (discriminator !== undefined && discriminator !== "" ? "\n" + discriminator : "");
  return fnv1aHash(input);
};

/**
 * Fingerprint for a failure with no stack to hash (native crashes, processes
 * gone): the identifying `parts` plus the app version, hashed like
 * {@link computeErrorFingerprint} so the backend dedupes both the same way.
 */
export const computeIdentityFingerprint = (appVersion: string, ...parts: string[]): string =>
  fnv1aHash([...parts, appVersion].join("\n"));

/** FNV-1a hash producing an 8-char hex string. Not cryptographic —
 *  used only for error deduplication fingerprints. */
const fnv1aHash = (input: string): string => {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0; // FNV prime, keep as uint32
  }
  return hash.toString(16).padStart(8, "0");
};
