import * as path from "path";

import * as fs from "../../../util/fs";

/**
 * Resolve each directory segment of `relPath` against the actual directory
 * names present on disk, using case-insensitive matching.
 *
 * On Windows (case-insensitive fs) this is a no-op — returns
 * `path.join(rootDir, relPath)` immediately.
 *
 * On Linux (case-sensitive fs) each directory segment is matched against
 * the actual entries in the parent directory.  If a match is found the
 * on-disk casing is used; if no match is found (directory does not exist
 * yet) the original segment is kept so that `ensureDir` can create it
 * later.  Errors from `readdirAsync` are swallowed: the original segment
 * is kept and traversal continues.
 *
 * The optional `dirCache` parameter lets callers reuse readdir results
 * across many files in a single deployment cycle (pass a new
 * `Map<string, string[]>` per `finalize()` call).
 *
 * @param rootDir  Absolute base directory (e.g. the game's data path).
 * @param relPath  Relative path under rootDir (may use `/` or `path.sep`).
 * @param dirCache Optional cache to avoid repeated readdir calls.
 * @returns        Absolute path with case-corrected directory segments.
 */
export async function resolvePathCase(
  rootDir: string,
  relPath: string,
  dirCache?: Map<string, string[]>,
): Promise<string> {
  if (process.platform === "win32") {
    return path.join(rootDir, relPath);
  }

  // Normalise to forward slashes then split so we handle both separators.
  const segments = relPath.replace(/\\/g, "/").split("/").filter(Boolean);

  if (segments.length === 0) {
    return rootDir;
  }

  // Resolve every segment (including the filename) against the actual entries
  // on disk.  This ensures that removeDeployedFile can unlink a file even when
  // the deployment record stores a different case than what is on disk.
  // If no match is found for a segment (new file/dir), the original is kept so
  // that ensureDir / link operations can create it with the intended casing.
  let currentPath = rootDir;

  for (const segment of segments) {
    let entries: string[];
    try {
      if (dirCache !== undefined && dirCache.has(currentPath)) {
        entries = dirCache.get(currentPath)!;
      } else {
        entries = await fs.readdirAsync(currentPath);
        if (dirCache !== undefined) {
          dirCache.set(currentPath, entries);
        }
      }

      const lower = segment.toLowerCase();
      const match = entries.find((e) => e.toLowerCase() === lower);
      currentPath = path.join(currentPath, match !== undefined ? match : segment);
    } catch {
      // Directory doesn't exist yet or readdir failed — preserve original
      // segment so ensureDir / link operations can create it later.
      currentPath = path.join(currentPath, segment);
    }
  }

  return currentPath;
}
