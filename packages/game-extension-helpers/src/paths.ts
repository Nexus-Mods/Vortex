/**
 * Shared path helpers for modernizing legacy Vortex game extensions.
 *
 * ## Public API
 * - `PathGroups`
 * - `isDirectoryPath()`
 * - `splitPathsByKind()`
 * - `toRelativePaths()`
 */
import { RelativePath } from "@vortex/paths";

/**
 * Stores normalized installer-relative file paths and explicit directory paths.
 *
 * ## Properties
 * - `files`: Normalized [RelativePath][] values for installer files.
 * - `directories`: Normalized [RelativePath][] values for explicit directory
 *   markers from installer input.
 */
export interface PathGroups {
  files: RelativePath[];
  directories: RelativePath[];
}

/**
 * Detects whether a path explicitly marks a directory.
 *
 * ## Arguments
 * - `path`: Path string where a trailing `/` or `\\` means
 *   the caller supplied a directory marker.
 *
 * ## Returns
 * - `true` when `path` ends with a path separator; otherwise `false`.
 */
export function isDirectoryPath(path: string): boolean {
  if (path.length === 0) return false;
  const last = path.charCodeAt(path.length - 1);
  return last === 47 || last === 92; // '/' = 47, '\\' = 92
}

/**
 * Normalizes raw path strings into `RelativePath` values.
 *
 * ## Arguments
 * - `paths`: Raw path strings.
 *
 * ## Returns
 * - Normalized [RelativePath][] values in first-seen order.
 *
 * ## Errors
 * - Invalid path strings are skipped.
 *
 * ## Examples
 *
 * ✅ File paths only (correct usage):
 *
 * ```typescript
 * toRelativePaths(["/Pack/Content/Data.xnb", "Pack\\Content\\Data.xnb"]);
 * // => ["Pack/Content/Data.xnb", "Pack/Content/Data.xnb"]
 * ```
 *
 * ❌ Mixed content (wrong).
 *
 * Some Vortex APIs (like installer callbacks) pass files and directories
 * together. After normalization, you can't tell them apart:
 *
 * ```typescript
 * // `["Pack/Mods/", "Pack/Mods"]` becomes `["Pack/Mods", "Pack/Mods"]`
 * // Use `splitPathsByKind()` for mixed content instead.
 * ```
 */
export function toRelativePaths(paths: string[]): RelativePath[] {
  const normalized: RelativePath[] = [];

  for (const path of paths) {
    try {
      normalized.push(RelativePath.make(path));
    } catch {
      continue;
    }
  }

  return normalized;
}

/**
 * Splits raw installer paths into normalized files and explicit directories.
 *
 * ## Arguments
 * - `paths`: Raw installer-relative paths where trailing separators mark
 *   explicit directories.
 *
 * ## Returns
 * - [PathGroups] with normalized file paths and normalized explicit directory
 *   paths.
 *
 * ## Examples
 * ```typescript
 * const result = splitPathsByKind([
 *   "Pack/Content/",
 *   "Pack/Content/Data.xnb",
 *   "Pack/Mods/"
 * ]);
 *
 * // Values shown as strings for readability; elements are RelativePath values.
 * result.files;       // ["Pack/Content/Data.xnb"]
 * result.directories; // ["Pack/Content", "Pack/Mods"]
 * ```
 *
 * ## Errors
 * - Invalid path strings are skipped to match current installer behavior.
 */
export function splitPathsByKind(paths: string[]): PathGroups {
  const files: RelativePath[] = [];
  const directories: RelativePath[] = [];

  for (const path of paths) {
    const bucket = isDirectoryPath(path) ? directories : files;

    try {
      bucket.push(RelativePath.make(path));
    } catch {
      continue;
    }
  }

  return { files, directories };
}
