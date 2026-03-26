/**
 * Pure TypeScript path utilities — no Node.js imports
 *
 * Provides POSIX and Win32 path manipulation functions that are
 * semantically equivalent to Node.js `path.posix` and `path.win32`.
 * All operations are deterministic string transformations.
 */

// ============================================================================
// PathModule interface
// ============================================================================

export interface PathModule {
  readonly sep: string;
  dirname(p: string): string;
  basename(p: string, ext?: string): string;
  extname(p: string): string;
  join(...segments: string[]): string;
  normalize(p: string): string;
  isAbsolute(p: string): boolean;
  parse(p: string): {
    root: string;
    dir: string;
    base: string;
    ext: string;
    name: string;
  };
  relative(from: string, to: string): string;
  resolve(base: string, ...segments: string[]): string;
}

// ============================================================================
// POSIX implementation
// ============================================================================

function posixIsAbsolute(p: string): boolean {
  return p.length > 0 && p.charCodeAt(0) === 0x2f; // '/'
}

function posixNormalize(p: string): string {
  if (p.length === 0) return ".";

  const isAbs = posixIsAbsolute(p);
  const trailingSep = p.charCodeAt(p.length - 1) === 0x2f;

  const parts = p.split("/");
  const normalized: string[] = [];

  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (normalized.length > 0 && normalized[normalized.length - 1] !== "..") {
        normalized.pop();
      } else if (!isAbs) {
        normalized.push("..");
      }
    } else {
      normalized.push(part);
    }
  }

  let result = normalized.join("/");
  if (isAbs) {
    result = "/" + result;
  }
  if (result.length === 0) {
    result = isAbs ? "/" : ".";
  } else if (trailingSep && result !== "/") {
    result += "/";
  }
  return result;
}

function posixJoin(...segments: string[]): string {
  if (segments.length === 0) return ".";
  const joined = segments.filter((s) => s.length > 0).join("/");
  if (joined.length === 0) return ".";
  return posixNormalize(joined);
}

function posixDirname(p: string): string {
  if (p.length === 0) return ".";
  const isAbs = posixIsAbsolute(p);
  // Remove trailing slashes
  let end = p.length - 1;
  while (end > 0 && p.charCodeAt(end) === 0x2f) end--;

  // Find last separator
  let i = end;
  while (i > 0 && p.charCodeAt(i) !== 0x2f) i--;

  if (i === 0) {
    return isAbs ? "/" : ".";
  }

  // Remove trailing slashes from result
  while (i > 1 && p.charCodeAt(i - 1) === 0x2f) i--;

  return p.slice(0, i);
}

function posixBasename(p: string, ext?: string): string {
  if (p.length === 0) return "";

  // Remove trailing slashes
  let end = p.length - 1;
  while (end > 0 && p.charCodeAt(end) === 0x2f) end--;

  // Find last separator
  let start = end;
  while (start > 0 && p.charCodeAt(start - 1) !== 0x2f) start--;

  let base = p.slice(start, end + 1);

  if (ext !== undefined && ext.length > 0 && base.endsWith(ext)) {
    base = base.slice(0, base.length - ext.length);
  }
  return base;
}

function posixExtname(p: string): string {
  // Get the basename first (strip dirs)
  const base = posixBasename(p);
  if (base.length === 0) return "";

  const dotIdx = base.lastIndexOf(".");
  // No dot, or dot is the first character (hidden files like .gitignore)
  if (dotIdx <= 0) return "";
  return base.slice(dotIdx);
}

function posixParse(p: string): {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
} {
  const root = posixIsAbsolute(p) ? "/" : "";
  const dir = posixDirname(p);
  const base = posixBasename(p);
  const ext = posixExtname(p);
  const name = ext.length > 0 ? base.slice(0, base.length - ext.length) : base;
  return { root, dir: dir === "." && root === "" ? "" : dir, base, ext, name };
}

function posixResolve(base: string, ...segments: string[]): string {
  let resolved = base;
  for (const seg of segments) {
    if (posixIsAbsolute(seg)) {
      resolved = seg;
    } else {
      resolved = resolved + "/" + seg;
    }
  }
  return posixNormalize(resolved);
}

function posixTrimTrailingSep(p: string): string {
  return p.length > 1 && p.charCodeAt(p.length - 1) === 0x2f // '/'
    ? p.slice(0, -1)
    : p;
}

function posixRelative(from: string, to: string): string {
  const fromCanon = posixTrimTrailingSep(posixNormalize(from));
  const toCanon = posixTrimTrailingSep(posixNormalize(to));

  if (fromCanon === toCanon) return "";

  const fromParts = fromCanon === "/" ? [""] : fromCanon.split("/");
  const toParts = toCanon === "/" ? [""] : toCanon.split("/");

  // Find common prefix length
  let commonLen = 0;
  const maxLen = Math.min(fromParts.length, toParts.length);
  for (let i = 0; i < maxLen; i++) {
    if (fromParts[i] !== toParts[i]) break;
    commonLen++;
  }

  const ups = fromParts.length - commonLen;
  const downs = toParts.slice(commonLen);

  const parts: string[] = [];
  for (let i = 0; i < ups; i++) parts.push("..");
  parts.push(...downs);

  return parts.join("/");
}

export const posix: PathModule = {
  sep: "/",
  dirname: posixDirname,
  basename: posixBasename,
  extname: posixExtname,
  join: posixJoin,
  normalize: posixNormalize,
  isAbsolute: posixIsAbsolute,
  parse: posixParse,
  relative: posixRelative,
  resolve: posixResolve,
};

// ============================================================================
// Win32 implementation
// ============================================================================

/**
 * Check if a character code is a Windows drive letter (a-z or A-Z)
 */
function isDriveLetter(code: number): boolean {
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
}

/**
 * Check if a character is a path separator (/ or \)
 */
function isWin32Sep(code: number): boolean {
  return code === 0x2f || code === 0x5c; // '/' or '\'
}

function win32IsAbsolute(p: string): boolean {
  if (p.length === 0) return false;
  // UNC path: \\server or //server
  if (isWin32Sep(p.charCodeAt(0))) {
    return p.length > 1 && isWin32Sep(p.charCodeAt(1));
  }
  // Drive letter: C:\ or C:/
  if (
    p.length >= 3 &&
    isDriveLetter(p.charCodeAt(0)) &&
    p.charCodeAt(1) === 0x3a /* ':' */ &&
    isWin32Sep(p.charCodeAt(2))
  ) {
    return true;
  }
  return false;
}

/**
 * Extract the root portion of a Windows path.
 * E.g., "C:\foo" → "C:\", "\\server\share" → "\\server\share\"
 */
function win32Root(p: string): string {
  if (p.length === 0) return "";
  // Drive root: C:\ or C:/
  if (
    p.length >= 3 &&
    isDriveLetter(p.charCodeAt(0)) &&
    p.charCodeAt(1) === 0x3a &&
    isWin32Sep(p.charCodeAt(2))
  ) {
    return p.slice(0, 3).replace(/\//g, "\\");
  }
  // UNC path: \\server\share
  if (
    p.length >= 2 &&
    isWin32Sep(p.charCodeAt(0)) &&
    isWin32Sep(p.charCodeAt(1))
  ) {
    // Find \\server\share
    let j = 2;
    while (j < p.length && !isWin32Sep(p.charCodeAt(j))) j++; // skip server
    if (j < p.length) {
      j++; // skip separator
      while (j < p.length && !isWin32Sep(p.charCodeAt(j))) j++; // skip share
    }
    return p.slice(0, j).replace(/\//g, "\\") + "\\";
  }
  return "";
}

/**
 * Split a win32 path into root + segments (normalizing separators)
 */
function win32Split(p: string): { root: string; parts: string[] } {
  const root = win32Root(p);
  const rest = p.slice(root.length);
  // Split on both separators
  const parts = rest.split(/[/\\]/).filter((s) => s.length > 0);
  return { root, parts };
}

function win32Normalize(p: string): string {
  if (p.length === 0) return ".";

  const { root, parts } = win32Split(p);
  const isAbs = root.length > 0;
  const trailingSep = isWin32Sep(p.charCodeAt(p.length - 1));

  const normalized: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      if (normalized.length > 0 && normalized[normalized.length - 1] !== "..") {
        normalized.pop();
      } else if (!isAbs) {
        normalized.push("..");
      }
    } else {
      normalized.push(part);
    }
  }

  let result = root + normalized.join("\\");
  if (result.length === 0) {
    result = ".";
  } else if (trailingSep && !result.endsWith("\\")) {
    result += "\\";
  }
  return result;
}

function win32Join(...segments: string[]): string {
  if (segments.length === 0) return ".";
  const joined = segments.filter((s) => s.length > 0).join("\\");
  if (joined.length === 0) return ".";
  return win32Normalize(joined);
}

function win32Dirname(p: string): string {
  if (p.length === 0) return ".";

  const { root } = win32Split(p);

  // Remove trailing separators
  let end = p.length - 1;
  while (end > root.length && isWin32Sep(p.charCodeAt(end))) end--;

  // Find last separator
  let i = end;
  while (i > root.length && !isWin32Sep(p.charCodeAt(i))) i--;

  if (i <= root.length) {
    // No separator found after root
    if (root.length > 0) {
      return root.endsWith("\\") ? root : root + "\\";
    }
    return ".";
  }

  // Remove trailing separators from result
  while (i > root.length && isWin32Sep(p.charCodeAt(i - 1))) i--;

  let dir = p.slice(0, i);
  // Normalize separators
  dir = dir.replace(/\//g, "\\");
  return dir;
}

function win32Basename(p: string, ext?: string): string {
  if (p.length === 0) return "";

  // Remove trailing separators
  let end = p.length - 1;
  while (end > 0 && isWin32Sep(p.charCodeAt(end))) end--;

  // Find last separator
  let start = end;
  while (
    start > 0 &&
    !isWin32Sep(p.charCodeAt(start - 1)) &&
    p.charCodeAt(start - 1) !== 0x3a
  )
    start--;

  let base = p.slice(start, end + 1);

  if (ext !== undefined && ext.length > 0 && base.endsWith(ext)) {
    base = base.slice(0, base.length - ext.length);
  }
  return base;
}

function win32Extname(p: string): string {
  const base = win32Basename(p);
  if (base.length === 0) return "";

  const dotIdx = base.lastIndexOf(".");
  if (dotIdx <= 0) return "";
  return base.slice(dotIdx);
}

function win32Parse(p: string): {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
} {
  const root = win32Root(p);
  const dir = win32Dirname(p);
  const base = win32Basename(p);
  const ext = win32Extname(p);
  const name = ext.length > 0 ? base.slice(0, base.length - ext.length) : base;
  return { root, dir: dir === "." ? "" : dir, base, ext, name };
}

function win32Resolve(base: string, ...segments: string[]): string {
  let resolved = base;
  for (const seg of segments) {
    if (win32IsAbsolute(seg)) {
      resolved = seg;
    } else {
      resolved = resolved + "\\" + seg;
    }
  }
  return win32Normalize(resolved);
}

function win32Relative(from: string, to: string): string {
  const fromNorm = win32Normalize(from);
  const toNorm = win32Normalize(to);

  if (fromNorm.toLowerCase() === toNorm.toLowerCase()) return "";

  const { root: fromRoot, parts: fromParts } = win32Split(fromNorm);
  const { root: toRoot, parts: toParts } = win32Split(toNorm);

  // Different roots → can't compute relative
  if (fromRoot.toLowerCase() !== toRoot.toLowerCase()) {
    return toNorm;
  }

  // Find common prefix length (case-insensitive for Windows)
  let commonLen = 0;
  const maxLen = Math.min(fromParts.length, toParts.length);
  for (let i = 0; i < maxLen; i++) {
    if (fromParts[i].toLowerCase() !== toParts[i].toLowerCase()) break;
    commonLen++;
  }

  const ups = fromParts.length - commonLen;
  const downs = toParts.slice(commonLen);

  const parts: string[] = [];
  for (let i = 0; i < ups; i++) parts.push("..");
  parts.push(...downs);

  return parts.join("\\");
}

export const win32: PathModule = {
  sep: "\\",
  dirname: win32Dirname,
  basename: win32Basename,
  extname: win32Extname,
  join: win32Join,
  normalize: win32Normalize,
  isAbsolute: win32IsAbsolute,
  parse: win32Parse,
  relative: win32Relative,
  resolve: win32Resolve,
};

// ============================================================================
// Platform detection helper
// ============================================================================

/**
 * Detect which path module should handle an already-resolved path string.
 *
 * Windows paths are recognized in two forms:
 * - UNC roots: `\\server\share\...` or `//server/share/...`
 * - Drive roots: `C:\...` or `C:/...`
 *
 * Everything else falls back to POSIX handling.
 */
export function detectPathModule(p: string): PathModule {
  // UNC shares are absolute Windows paths even without a drive letter.
  if (/^(?:\\\\|\/\/)/.test(p)) return win32;
  // Standard Windows drive-rooted path.
  if (/^[a-zA-Z]:[/\\]/.test(p)) return win32;
  return posix;
}

/**
 * Return the path module for a given platform identifier.
 */
export function forPlatform(platform: "windows" | "unix"): PathModule {
  return platform === "windows" ? win32 : posix;
}
