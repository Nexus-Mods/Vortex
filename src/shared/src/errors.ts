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

type ErrorWithSystemCode = Error & { systemCode: number | bigint };

/** Extracts the system code property from a potential error object */
export function isErrorWithSystemCode(
  err: unknown,
): err is ErrorWithSystemCode {
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
  frame
    .replace(INSTALL_PATH_RE, "")
    .replace(/\\/g, "/")
    .replace(USER_HOME_RE, "$1<USER>");

const _SEP = String.raw`[/\\]`;
const _WIN = String.raw`[A-Za-z]:${_SEP}`; // C:\ or C:/
const _UNIX = String.raw`(?<!\/)\/`; // / not inside ://
const _SEGS = String.raw`(?:[^/\\():]+${_SEP})*?`; // lazy path segments
const _ANCHORS = String.raw`(?:src|node_modules|app\.asar(?:\.unpacked)?|plugins)`;
/** Matches the installation-specific prefix of a stack frame path up to the first
 * stable segment (src, node_modules, app.asar, or plugins). */
const INSTALL_PATH_RE = new RegExp(
  String.raw`(?:${_WIN}|${_UNIX})${_SEGS}(?=${_ANCHORS}${_SEP})`,
  "g",
);

/** Matches the username segment of a user-home path (`/Users/<name>` or
 * `/home/<name>`). Run after backslash normalization so only forward slashes
 * need to be considered. The username character class excludes `<` so that
 * already-redacted `<USER>` is not matched again (idempotence). */
const USER_HOME_RE = /(\/(?:Users|home)\/)([^/\s'"<>:|?*]+)/gi;

/**
 * Compute a fingerprint from the stack trace call frames and app version.
 * Same error from the same code path in the same version produces the same hash,
 * which can be used for deduplication on the backend.
 */
export const computeErrorFingerprint = (
  stack: string | undefined,
  appVersion: string,
): string | undefined => {
  if (stack === undefined) return undefined;
  const frames = stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .map(sanitizeFramePath);
  if (frames.length === 0) return undefined;
  const input = frames.join("\n") + "\n" + appVersion;
  return fnv1aHash(input);
};

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
