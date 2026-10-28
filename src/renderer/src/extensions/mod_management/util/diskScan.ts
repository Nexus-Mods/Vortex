import {
  DiskEntryKind,
  folderKeyOf,
  pathKeyOf,
  type DiskEntry,
  type DiskScan,
} from "@nexusmods/mod-pipeline";
import { parseError, VortexError } from "@vortex/shared";
import { QualifiedPath, type Status } from "@vortex/shared/filesystem";

/** Combine the folders of mods and folders destination paths. The mod paths and the folder of any destination outside them, none nested. */
function combineRootsFromPaths(
  modPaths: Iterable<string | null | undefined>,
  destinationPaths: Iterable<string>,
): QualifiedPath[] {
  const modRoots = [...modPaths]
    .filter((modPath) => modPath !== null && modPath !== undefined && modPath !== "")
    .map((modPath) => QualifiedPath.fromNative(modPath));
  const modRootPrefixes = modRoots.map((modRoot) => folderKeyOf(modRoot.path));
  const outsideFolders: QualifiedPath[] = [];
  for (const destinationPath of destinationPaths) {
    const destinationKey = pathKeyOf(destinationPath);
    if (!modRootPrefixes.some((prefix) => destinationKey.startsWith(prefix))) {
      outsideFolders.push(QualifiedPath.fromNative(destinationPath).parent());
    }
  }
  const rootByKey = new Map(
    [...modRoots, ...outsideFolders].map((root) => [pathKeyOf(root.path), root]),
  );
  const roots = [...rootByKey.values()];
  return roots
    .filter((root) =>
      roots.every(
        (other) => other === root || !pathKeyOf(root.path).startsWith(folderKeyOf(other.path)),
      ),
    )
    .toSorted((lhs, rhs) => (lhs.path < rhs.path ? -1 : 1));
}

/** A folder's identity, shared by every path that reaches it. */
const folderIdOf = (status: Status) => `${status.deviceId}:${status.id}`;

/**
 * Recursively adds all files to entries parameter under a folder. Also walking into links to folders;
 * a missing folder adds nothing, links that point back to added entries are skipped.
 */
async function addEntriesUnder(
  folder: QualifiedPath,
  chain: ReadonlySet<string>,
  entries: DiskEntry[],
): Promise<void> {
  let listing: AsyncIterableIterator<[QualifiedPath, Status], undefined>;
  try {
    // "symlink" lists a link as an entry with its target's status; a link whose target is gone is not listed
    listing = await window.api.fs.enumerateDirectory(folder, {
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
  const linkedFolders: Array<{ linkPath: QualifiedPath; folderId: string }> = [];
  for await (const [entryPath, status] of listing) {
    // only a native path's .path is its path on disk
    if (entryPath.scheme !== "native") {
      throw new VortexError(`${entryPath.value} is not a native path`, {
        kind: "fs:invalid-path",
        path: entryPath.value,
      });
    }
    if (!status.isFile) {
      if (status.isSymLink) {
        linkedFolders.push({
          linkPath: entryPath,
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
      let parent = linkPath.parent();
      parent.path.length > folder.path.length;
      parent = parent.parent()
    ) {
      const parentId = folderIdByKey.get(pathKeyOf(parent.path));
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
async function chainAt(root: QualifiedPath): Promise<ReadonlySet<string>> {
  const status = await window.api.fs.stat(root);
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
    roots: roots.map((root) => root.path),
    entries: entries.toSorted((lhs, rhs) => (lhs.path < rhs.path ? -1 : 1)),
  };
}
