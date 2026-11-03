import { relativePath, type RelativePath } from "@nexusmods/paths";
import { VortexModStagingFolder } from "@vortex/shared";
import type { QualifiedPath } from "@vortex/shared/filesystem";

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

/**
 * The files that already exist at `finalPaths`' directories in the game folder, as the keys
 * `classifyDestinationFiles` takes. It reads each directory once, not each file.
 */
export async function existingGameFiles(
  root: QualifiedPath,
  finalPaths: readonly RelativePath[],
): Promise<Set<string>> {
  const directories = new Map<string, RelativePath>();

  for (const finalPath of finalPaths) {
    const directory = parentOf(finalPath);
    directories.set(directory.toLowerCase(), directory);
  }

  const existing = new Set<string>();

  await Promise.all(
    [...directories.values()].map(async (directory) => {
      for (const entry of await readFileTreeDirectory(root, directory)) {
        if (entry.kind === "file") {
          existing.add(entry.path.toLowerCase());
        }
      }
    }),
  );

  return existing;
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
