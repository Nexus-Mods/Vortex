/**
 * Filesystem helpers used by config-mod sync and transition flows.
 */
import type { IEntry, IWalkOptions } from "turbowalk";

import turbowalk from "turbowalk";
import { fs } from "vortex-api";

/** Recursively walks a directory with safe defaults and returns collected entries. */
export async function walkPath(
  dirPath: string,
  walkOptions?: IWalkOptions,
): Promise<IEntry[]> {
  walkOptions = walkOptions
    ? {
        ...walkOptions,
        skipHidden: true,
        skipInaccessible: true,
        skipLinks: true,
      }
    : { skipLinks: true, skipHidden: true, skipInaccessible: true };
  const walkResults: IEntry[] = [];
  try {
    await turbowalk(
      dirPath,
      (entries: IEntry[]) => {
        walkResults.push(...entries);
        return Promise.resolve() as any;
      },
      walkOptions,
    );
    // If the directory is missing when we try to walk it; it's most probably down to a collection being
    // in the process of being installed/removed. We can safely ignore this.
  } catch (err) {
    if ((err as any).code !== "ENOENT") {
      throw err;
    }
  }

  return walkResults;
}

/** Deletes a directory by removing nested entries from deepest to shallowest. */
export async function deleteFolder(
  dirPath: string,
  walkOptions?: IWalkOptions,
): Promise<void> {
  try {
    const entries = await walkPath(dirPath, walkOptions);
    entries.sort((a, b) => b.filePath.length - a.filePath.length);
    for (const entry of entries) {
      await fs.removeAsync(entry.filePath);
    }
    await fs.rmdirAsync(dirPath);
  } catch (err) {
    return Promise.reject(err);
  }
}
