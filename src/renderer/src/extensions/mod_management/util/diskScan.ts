import * as path from "node:path";

import { DiskEntryKind, pathKeyOf, type DiskEntry, type DiskScan } from "@nexusmods/mod-pipeline";
import { parseError } from "@vortex/shared";
import { QualifiedPath, type Status } from "@vortex/shared/filesystem";

const prefixKeyOf = (folder: string) => pathKeyOf(folder.endsWith("/") ? folder : `${folder}/`);

/** The folders to walk: the mod paths and the folder of any destination outside them, none nested. */
function scanRoots(
  modPaths: Iterable<string | null | undefined>,
  destinationPaths: Iterable<string>,
): string[] {
  const modRoots = [...modPaths]
    .filter((modPath) => modPath !== null && modPath !== undefined && modPath !== "")
    .map((modPath) => QualifiedPath.fromNative(modPath).path);
  const modRootPrefixes = modRoots.map(prefixKeyOf);
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
        (other) => other === root || !pathKeyOf(root).startsWith(prefixKeyOf(other)),
      ),
    )
    .toSorted();
}

/** Adds the files and links under a root; a missing root adds nothing. */
async function addEntriesUnder(root: string, entries: DiskEntry[]): Promise<void> {
  let listing: AsyncIterableIterator<[QualifiedPath, Status], undefined>;
  try {
    // "symlink" lists a link as an entry with its target's status; a link whose target is gone is not listed
    listing = await window.api.fs.enumerateDirectory(QualifiedPath.fromNative(root), {
      recursive: true,
      includeStatus: "symlink",
    });
  } catch (err) {
    if (parseError(err).data.kind === "fs:not-found") {
      return;
    }
    throw err;
  }
  try {
    for await (const [entryPath, status] of listing) {
      if (!status.isSymLink && !status.isFile) {
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
  } catch (err) {
    // for await does not close a listing whose next() rejected
    await listing.return?.();
    throw err;
  }
}

/** The files and links under the deployment targets; links are listed, not walked into. */
export async function scanDeploymentTargets(
  modPaths: Iterable<string | null | undefined>,
  destinationPaths: Iterable<string>,
): Promise<DiskScan> {
  const takenAt = Temporal.Now.instant();
  const roots = scanRoots(modPaths, destinationPaths);
  const entries: DiskEntry[] = [];
  for (const root of roots) {
    await addEntriesUnder(root, entries);
  }
  return {
    takenAt,
    roots,
    entries: entries.toSorted((lhs, rhs) => (lhs.path < rhs.path ? -1 : 1)),
  };
}
