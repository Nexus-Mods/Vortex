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
  /** The mod being installed, or the one it replaces, has deployed a file to the same path. */
  | { kind: "replacesOwnFile" }
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

/** What `deployedFiles` found, keyed by lowercased path in the game folder. */
export interface IDeployedFiles {
  /** The files other mods have deployed, with the staging folder of the mod that deployed each. */
  byOtherMods: ReadonlyMap<string, VortexModStagingFolder>;
  /** The files the mod being installed, or the one it replaces, has deployed. */
  byOwnMod: ReadonlySet<string>;
}

/**
 * The files mods have deployed, by their path in the game folder. Files from `ownStagingFolders`,
 * the folders of the mod being installed and of the one it replaces, are the mod's own; the rest
 * are other mods', with the staging folder of the mod that deployed each. The manifest has one
 * entry per path, but if a path shows up twice, the entry listed last is kept.
 *
 * The paths are for the default mod type, whose files go to the game root of a Tier 0 game.
 */
export function deployedFiles(
  manifest: IDeploymentManifest,
  ownStagingFolders: readonly VortexModStagingFolder[],
): IDeployedFiles {
  const own = new Set<string>(ownStagingFolders);
  const byOtherMods = new Map<string, VortexModStagingFolder>();
  const byOwnMod = new Set<string>();

  for (const file of manifest.files) {
    if (file.source === "") {
      continue;
    }

    const key = pathKey(file.target ? `${file.target}/${file.relPath}` : file.relPath);

    if (key === undefined) {
      continue;
    }

    if (own.has(file.source)) {
      byOtherMods.delete(key);
      byOwnMod.add(key);
    } else {
      byOwnMod.delete(key);
      byOtherMods.set(key, VortexModStagingFolder(file.source));
    }
  }

  return { byOtherMods, byOwnMod };
}

/** What `existingGameFiles` found. */
export interface IExistingGameFiles {
  /** The keys `classifyDestinationFiles` takes. */
  files: Set<string>;
  /** Some directory couldn't be read, so `files` may miss what is in it. */
  hasFailed: boolean;
}

/**
 * How many directories `existingGameFiles` reads at once. A bound, not a tuned value: it keeps an
 * archive spanning hundreds of directories from putting a listing of each in flight over IPC at
 * once, beside whatever else main is doing.
 */
export const DIRECTORY_READ_CONCURRENCY = 8;

/** Runs a read once one of the limited slots is free. */
type Limit = <T>(read: () => Promise<T>) => Promise<T>;

/**
 * Reads directories of one game folder for `existingGameFiles`. The files each directory held are
 * kept by its lowercased path, to read it only once; a directory that failed is left out so it is
 * tried again. Reads share one limit on how many run at once, across calls.
 */
export interface IDirectoryReader {
  /** Each directory's read, finished or not. */
  cache: Map<string, Promise<string[]>>;
  /** The files of each directory whose read succeeded, for `cachedGameFiles` to use at once. */
  settled: Map<string, string[]>;
  limit: Promise<Limit>;
}

export function createDirectoryReader(
  concurrency: number = DIRECTORY_READ_CONCURRENCY,
): IDirectoryReader {
  return {
    cache: new Map(),
    settled: new Map(),
    // ESM-only against a CommonJS renderer, so a static import fails typecheck (TS1479)
    limit: import("p-limit").then(({ default: pLimit }) => pLimit(concurrency)),
  };
}

/** The directories `finalPaths` are in, by lowercased path, as the reader keys them. */
function destinationDirectories(finalPaths: readonly RelativePath[]): Map<string, RelativePath> {
  const directories = new Map<string, RelativePath>();

  for (const finalPath of finalPaths) {
    const directory = parentPath(finalPath);
    directories.set(directory.toLowerCase(), directory);
  }

  return directories;
}

/**
 * What `existingGameFiles` would find, without waiting, when `reader` has already read every
 * directory `finalPaths` are in; undefined if any of them is still to be read. A directory whose
 * read failed counts as still to be read, so it's tried again.
 */
export function cachedGameFiles(
  finalPaths: readonly RelativePath[],
  reader: IDirectoryReader,
): IExistingGameFiles | undefined {
  const files = new Set<string>();

  for (const key of destinationDirectories(finalPaths).keys()) {
    const found = reader.settled.get(key);

    if (found === undefined) {
      return undefined;
    }

    found.forEach((file) => files.add(file));
  }

  return { files, hasFailed: false };
}

/**
 * The files that already exist at `finalPaths`' directories in the game folder. It reads each
 * directory once, not each file, and a directory `reader` has read not again. A directory that
 * can't be read is skipped, and reported as `hasFailed`.
 */
export async function existingGameFiles(
  root: QualifiedPath,
  finalPaths: readonly RelativePath[],
  reader: IDirectoryReader = createDirectoryReader(),
): Promise<IExistingGameFiles> {
  const { cache } = reader;

  const reads = [...destinationDirectories(finalPaths)].map(async ([key, directory]) => {
    let read = cache.get(key);

    if (read === undefined) {
      read = reader.limit
        .then((limit) => limit(() => readFileTreeDirectory(root, directory)))
        .then((entries) => {
          const found = entries
            .filter(({ kind }) => kind === "file")
            .map(({ path }) => path.toLowerCase());

          reader.settled.set(key, found);

          return found;
        });
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
 * file the mod itself deployed before, replace a file of the game, or add a new one. A file a mod
 * has deployed counts as that mod's, not the game's, even though it's in the game folder too.
 */
export function classifyDestinationFiles(
  finalPaths: readonly RelativePath[],
  existing: ReadonlySet<string>,
  deployed: IDeployedFiles,
): IDestinationFile[] {
  return finalPaths.map((finalPath): IDestinationFile => {
    const key = finalPath.toLowerCase();
    const stagingFolder = deployed.byOtherMods.get(key);

    if (stagingFolder !== undefined) {
      return { path: finalPath, status: { kind: "conflictsWithMod", stagingFolder } };
    }

    if (deployed.byOwnMod.has(key)) {
      return { path: finalPath, status: { kind: "replacesOwnFile" } };
    }

    return {
      path: finalPath,
      status: { kind: existing.has(key) ? "replacesGameFile" : "new" },
    };
  });
}
