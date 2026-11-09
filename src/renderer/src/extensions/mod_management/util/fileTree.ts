import type { RelativePath } from "@nexusmods/paths";
import { parseError } from "@vortex/shared";
import type { QualifiedPath } from "@vortex/shared/filesystem";

import type { FileTreeEntry } from "@/ui/components/file_tree/buildTree";

/**
 * Reads what a directory holds as entries for a file tree, with paths relative to `root`.
 * A directory that doesn't exist holds nothing. Any other failure is thrown.
 *
 * @param root The tree's root.
 * @param directory The directory to read, relative to `root`.
 */
export async function readFileTreeDirectory(
  root: QualifiedPath,
  directory?: RelativePath,
): Promise<FileTreeEntry[]> {
  const entries: FileTreeEntry[] = [];

  try {
    const iterator = await window.api.fs.enumerateDirectory(root.join(directory ?? ""), {
      includeStatus: true,
    });

    for await (const [entry, status] of iterator) {
      entries.push({
        path: entry.relativeTo(root),
        kind: status.isFile ? "file" : "directory",
      });
    }

    return entries;
  } catch (err) {
    if (parseError(err).data.kind === "fs:not-found") {
      return [];
    }

    throw err;
  }
}
