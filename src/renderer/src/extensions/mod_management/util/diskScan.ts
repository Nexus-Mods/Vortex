import * as path from "node:path";

import {
  DiskEntryKind,
  folderKeyOf,
  pathKeyOf,
  type DiskEntry,
  type DiskScan,
} from "@nexusmods/mod-pipeline";
import { parseError } from "@vortex/shared";
import { QualifiedPath, type Status } from "@vortex/shared/filesystem";

/** Combine the folders of mods and folders destination paths. The mod paths and the folder of any destination outside them, none nested. */
function combineRootsFromPaths(
  modPaths: Iterable<string | null | undefined>,
  destinationPaths: Iterable<string>,
): string[] {
  const modRoots = [...modPaths]
    .filter((modPath) => modPath !== null && modPath !== undefined && modPath !== "")
    .map((modPath) => QualifiedPath.fromNative(modPath).path);
  const modRootPrefixes = modRoots.map(folderKeyOf);
  const outsideFolders = new Set<string>();
  for (const destinationPath of destinationPaths) {
    const destinationKey = pathKeyOf(destinationPath);
    if (!modRootPrefixes.some((prefix) => destinationKey.startsWith(prefix))) {
      outsideFolders.add(path.posix.dirname(destinationPath));
    }
  }
  const rootByKey = new Map(
    [...modRoots, ...outsideFolders].map((root) => [pathKeyOf(root), root]),
  );
  return [...rootByKey.values()]
    .filter((root) =>
      [...rootByKey.values()].every(
        (other) => other === root || !pathKeyOf(root).startsWith(folderKeyOf(other)),
      ),
    )
    .toSorted();
}

/** A folder's identity, shared by every path that reaches it. */
const folderIdOf = (status: Status) => `${status.deviceId}:${status.id}`;

/**
 * Recursively adds all files to entries parameter under a folder. Also walking into links to folders;
 * a missing folder adds nothing, links that point back to added entries are skipped.
 */
async function addEntriesUnder(
  folder: string,
  chain: ReadonlySet<string>,
  entries: DiskEntry[],
): Promise<void> {
  let listing: AsyncIterableIterator<[QualifiedPath, Status], undefined>;
  try {
    // "symlink" lists a link as an entry with its target's status; a link whose target is gone is not listed
    listing = await window.api.fs.enumerateDirectory(QualifiedPath.fromNative(folder), {
      recursive: true,
      includeStatus: "symlink",
    });
  } catch (err) {
    if (parseError(err).data.kind === "fs:not-found") {
      return;
    }
    throw err;
  }
  // the folders inside this one by path key, and the links to folders, walked once the listing ends
  const folderIdByKey = new Map<string, string>();
  const linkedFolders: Array<{ linkPath: string; folderId: string }> = [];
  for await (const [entryPath, status] of listing) {
    if (!status.isFile) {
      if (status.isSymLink) {
        linkedFolders.push({
          linkPath: entryPath.path,
          folderId: folderIdOf(status),
        });
      } else {
        folderIdByKey.set(pathKeyOf(entryPath.path), folderIdOf(status));
      }
      continue;
    }
    entries.push({
      path: entryPath.path,
      kind: status.isSymLink ? DiskEntryKind.Link : DiskEntryKind.File,
      size: status.isFile ? status.size : 0,
      modifiedTime: status.modifiedTime,
      id: status.id,
      deviceId: status.deviceId,
      hardlinkCount: status.hardlinkCount,
    });
  }
  for (const { linkPath, folderId } of linkedFolders) {
    const linkChain = new Set(chain);
    for (
      let parent = path.posix.dirname(linkPath);
      parent.length > folder.length;
      parent = path.posix.dirname(parent)
    ) {
      const parentId = folderIdByKey.get(pathKeyOf(parent));
      if (parentId !== undefined) {
        linkChain.add(parentId);
      }
    }
    if (!linkChain.has(folderId)) {
      await addEntriesUnder(linkPath, linkChain.add(folderId), entries);
    }
  }
}

/** The ids a walk from a root starts inside: the root's own; none for a missing root. */
async function chainAt(root: string): Promise<ReadonlySet<string>> {
  const status = await window.api.fs.stat(QualifiedPath.fromNative(root));
  return new Set(status.exists ? [folderIdOf(status)] : []);
}

/** Scans and returns all files in folder the mod and destination paths. Called
 * from resolveLockFile.ts to do a disk scan for a mod type
 */
export async function scanDeploymentTargets(
  modPaths: Iterable<string | null | undefined>,
  destinationPaths: Iterable<string>,
): Promise<DiskScan> {
  const takenAt = Temporal.Now.instant();
  const roots = combineRootsFromPaths(modPaths, destinationPaths);
  const entries: DiskEntry[] = [];
  for (const root of roots) {
    await addEntriesUnder(root, await chainAt(root), entries);
  }
  return {
    takenAt,
    roots,
    entries: entries.toSorted((lhs, rhs) => (lhs.path < rhs.path ? -1 : 1)),
  };
}
