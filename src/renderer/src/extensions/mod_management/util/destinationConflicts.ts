import { relativePath, type RelativePath } from "@nexusmods/paths";
import { VortexModStagingFolder } from "@vortex/shared";
import type { QualifiedPath } from "@vortex/shared/filesystem";

import { log } from "@/logging";
import { parentPath } from "@/ui/components/file_tree/types";

import type { IDeploymentManifest } from "../types/IDeploymentManifest";
import { readFileTreeDirectory } from "./fileTree";

/** What installing a file to its final path does to the game folder. */
export type DestinationFileStatus =
  | { kind: "new" }
  | { kind: "replacesGameFile" }
  /** Another mod has deployed a file to the same path; this is its staging folder. */
  | { kind: "conflictsWithMod"; stagingFolder: VortexModStagingFolder };

export interface IDestinationFile {
  /** Relative to the game root. */
  path: RelativePath;
  status: DestinationFileStatus;
}

// Paths compare without regard to case, as `QualifiedPath` does.
function pathKey(value: string): string | undefined {
  try {
    return relativePath(value).toLowerCase();
  } catch {
    // not relative to the game root, so it can't be a file of ours to conflict with
    return undefined;
  }
}

/**
 * The files other mods have deployed, by their path in the game folder, with the staging folder
 * of the mod that deployed each. Files from `ownStagingFolders`, the folders of the mod being
 * installed and of the one it replaces, aren't included. If two mods deployed the same path, the
 * one deployed last is kept.
 *
 * The paths are for the default mod type, whose files go to the game root of a Tier 0 game.
 */
export function deployedByOtherMods(
  manifest: IDeploymentManifest,
  ownStagingFolders: readonly VortexModStagingFolder[],
): Map<string, VortexModStagingFolder> {
  const own = new Set<string>(ownStagingFolders);
  const deployed = new Map<string, VortexModStagingFolder>();

  for (const file of manifest.files) {
    if (file.source === "" || own.has(file.source)) {
      continue;
    }

    const key = pathKey(file.target ? `${file.target}/${file.relPath}` : file.relPath);

    if (key !== undefined) {
      deployed.set(key, VortexModStagingFolder(file.source));
    }
  }

  return deployed;
}

/** What `existingGameFiles` found. */
export interface IExistingGameFiles {
  /** The keys `classifyDestinationFiles` takes. */
  files: Set<string>;
  /** Some directory couldn't be read, so `files` may miss what is in it. */
  hasFailed: boolean;
}

/**
 * The files each directory read held, by the directory's lowercased path, kept to read it only
 * once; a directory that failed is left out so it is tried again. It is for one game folder.
 */
export type DirectoryFilesCache = Map<string, Promise<string[]>>;

/**
 * The files that already exist at `finalPaths`' directories in the game folder. It reads each
 * directory once, not each file, and a directory in `cache` not again. A directory that can't be
 * read is skipped, and reported as `hasFailed`.
 */
export async function existingGameFiles(
  root: QualifiedPath,
  finalPaths: readonly RelativePath[],
  cache: DirectoryFilesCache = new Map(),
): Promise<IExistingGameFiles> {
  const directories = new Map<string, RelativePath>();

  for (const finalPath of finalPaths) {
    const directory = parentPath(finalPath);
    directories.set(directory.toLowerCase(), directory);
  }

  const reads = [...directories].map(async ([key, directory]) => {
    let read = cache.get(key);

    if (read === undefined) {
      read = readFileTreeDirectory(root, directory).then((entries) =>
        entries.filter(({ kind }) => kind === "file").map(({ path }) => path.toLowerCase()),
      );
      cache.set(key, read);
    }

    try {
      return await read;
    } catch (err) {
      cache.delete(key);
      log("warn", "failed to read a game directory for the install result", { directory, err });
      return undefined;
    }
  });

  const files = new Set<string>();
  let hasFailed = false;

  for (const found of await Promise.all(reads)) {
    if (found === undefined) {
      hasFailed = true;
    } else {
      found.forEach((file) => files.add(file));
    }
  }

  return { files, hasFailed };
}

/**
 * Tells what installing each of `finalPaths` does: conflict with another mod's file, replace a
 * file of the game, or add a new one. A file another mod has deployed counts as that mod's, not
 * the game's, even though it's in the game folder too.
 */
export function classifyDestinationFiles(
  finalPaths: readonly RelativePath[],
  existing: ReadonlySet<string>,
  deployed: ReadonlyMap<string, VortexModStagingFolder>,
): IDestinationFile[] {
  return finalPaths.map((finalPath): IDestinationFile => {
    const key = finalPath.toLowerCase();
    const stagingFolder = deployed.get(key);

    if (stagingFolder !== undefined) {
      return { path: finalPath, status: { kind: "conflictsWithMod", stagingFolder } };
    }

    return {
      path: finalPath,
      status: { kind: existing.has(key) ? "replacesGameFile" : "new" },
    };
  });
}
