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

  // The last segment is a filename — only resolve directory segments.
  const dirSegments = segments.slice(0, -1);
  const filename = segments[segments.length - 1];

  let currentDir = rootDir;

  for (const segment of dirSegments) {
    let entries: string[];
    try {
      if (dirCache !== undefined && dirCache.has(currentDir)) {
        entries = dirCache.get(currentDir)!;
      } else {
        entries = await fs.readdirAsync(currentDir);
        if (dirCache !== undefined) {
          dirCache.set(currentDir, entries);
        }
      }

      const lower = segment.toLowerCase();
      const match = entries.find((e) => e.toLowerCase() === lower);
      currentDir = path.join(currentDir, match !== undefined ? match : segment);
    } catch {
      // Directory doesn't exist yet or readdir failed — preserve original
      // segment so ensureDir can create it later.
      currentDir = path.join(currentDir, segment);
    }
  }

  return path.join(currentDir, filename);
}
