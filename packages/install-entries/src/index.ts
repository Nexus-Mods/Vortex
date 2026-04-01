/**
 * Splits Vortex installer callback entries into typed file and directory lists.
 *
 * ## Public API
 * - `InstallEntries` stores normalized file and explicit directory entries.
 * - `isInstallDirectoryEntry` detects raw trailing-separator directory markers.
 * - `demuxInstallEntries` converts installer input into `{ files, directories }`.
 *
 * ## Directory Entries
 * Vortex installers may receive explicit directory markers such as `Content/`
 * or `Mods\\`. Those markers matter to callers even though `RelativePath.make()`
 * strips trailing separators during normalization.
 */
import { RelativePath } from "@vortex/paths";

/** Normalized Vortex installer entries grouped by file and explicit directory. */
export interface InstallEntries {
  files: RelativePath[];
  directories: RelativePath[];
}

/** Returns true when the raw installer entry explicitly marks a directory. */
export function isInstallDirectoryEntry(entry: string): boolean {
  return /[\\/]$/.test(entry);
}

/**
 * Converts raw Vortex installer entries into normalized file and directory
 * collections.
 *
 * @param entries Raw Vortex installer callback input.
 * @returns Normalized `{ files, directories }` collections that preserve
 * explicit directory markers and stable per-list ordering.
 *
 * ## Errors
 * Invalid path strings are skipped to match current installer behavior.
 */
export function demuxInstallEntries(entries: string[]): InstallEntries {
  const files: RelativePath[] = [];
  const directories: RelativePath[] = [];

  for (const entry of entries) {
    const bucket = isInstallDirectoryEntry(entry) ? directories : files;

    try {
      bucket.push(RelativePath.make(entry));
    } catch {
      continue;
    }
  }

  return { files, directories };
}
