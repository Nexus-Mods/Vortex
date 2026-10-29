import { readdir } from "node:fs/promises";
import * as path from "node:path";

/**
 * Per directory, the spelling each lowercased name resolves to: what's on
 * disk plus the names resolvePathCase claimed for entries not there yet.
 */
export type DirEntryCache = Map<string, Promise<Map<string, string>>>;

function knownEntries(dirPath: string, cache: DirEntryCache): Promise<Map<string, string>> {
  let entries = cache.get(dirPath);
  if (entries === undefined) {
    entries = readdir(dirPath)
      .catch(() => [] as string[])
      .then((names) => {
        const byLower = new Map<string, string>();
        // sorted, so every spelling of a name resolves to the same one of its variants
        for (const name of names.sort()) {
          const lower = name.toLowerCase();
          if (!byLower.has(lower)) {
            byLower.set(lower, name);
          }
        }
        return byLower;
      });
    cache.set(dirPath, entries);
  }
  return entries;
}

/**
 * Spell relPath the way it already exists below basePath, matching each component
 * case-insensitively. Where several case variants exist, every spelling resolves to the
 * same one, so they converge. A component that doesn't exist keeps its spelling and
 * claims it in the cache, so later paths sharing the cache resolve to the same spelling.
 */
export async function resolvePathCase(
  basePath: string,
  relPath: string,
  cache: DirEntryCache = new Map(),
): Promise<string> {
  let resolved = "";
  for (const part of relPath.split(/[\\/]+/).filter((p) => p.length > 0)) {
    const entries = await knownEntries(path.join(basePath, resolved), cache);
    const lower = part.toLowerCase();
    let match = entries.get(lower);
    if (match === undefined) {
      entries.set(lower, part);
      match = part;
    }
    resolved = path.join(resolved, match);
  }
  return resolved;
}

export async function resolveFileCase(dirPath: string, fileName: string): Promise<string> {
  return path.join(dirPath, await resolvePathCase(dirPath, fileName));
}
