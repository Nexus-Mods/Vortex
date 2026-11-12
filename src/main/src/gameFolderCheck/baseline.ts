/** Steam's list of installed files for a game, from the depot manifests in its depotcache. */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { GameFolderCheckInput } from "@vortex/shared/ipc";

import {
  DEPOT_FLAG,
  type IDepotFile,
  type IDepotManifest,
  readDepotManifest,
} from "./depotManifest";

/** The folder can't be judged: there is no Steam file list to compare it with. */
export class NoBaseline extends Error {
  constructor(public readonly reason: string) {
    super(`no baseline: ${reason}`);
  }
}

export interface IBaseline {
  /** Keyed by `pathKey` of the file's path relative to the game folder */
  files: Map<string, IDepotFile>;
  /** Creation time of each manifest file, keyed `<depot>_<manifest>` */
  manifestCreatedAt: Record<string, number | null>;
}

/** Steam and the games treat paths case-insensitively, with Windows separators. */
export function pathKey(relPath: string): string {
  return relPath.replace(/\//g, "\\").toLowerCase();
}

/** The path on disk for a manifest name, which always uses Windows separators. */
export function diskPath(gamePath: string, name: string): string {
  return path.join(gamePath, ...name.split("\\"));
}

export function depotManifestPath(steamPath: string, depotId: number, manifestId: string): string {
  return path.join(steamPath, "depotcache", `${depotId}_${manifestId}.manifest`);
}

async function readManifest(
  steamPath: string,
  depotId: number,
  manifestId: string,
): Promise<{ manifest: IDepotManifest; createdAt: number | null }> {
  const filePath = depotManifestPath(steamPath, depotId, manifestId);
  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch {
    throw new NoBaseline("manifest_missing");
  }
  let manifest: IDepotManifest;
  try {
    manifest = readDepotManifest(data);
  } catch {
    throw new NoBaseline("manifest_unreadable");
  }
  if (manifest.filenamesEncrypted) {
    throw new NoBaseline("filenames_encrypted");
  }
  const createdAt = await stat(filePath).then(
    (stats) => stats.birthtimeMs,
    () => null,
  );
  return { manifest, createdAt };
}

export async function loadBaseline(input: GameFolderCheckInput): Promise<IBaseline> {
  // Steam is mid-update: files may be half written
  if (input.targetBuildId !== 0 && input.targetBuildId !== input.buildId) {
    throw new NoBaseline("steam_updating");
  }
  if (input.depots.length === 0) {
    throw new NoBaseline("no_depots");
  }

  const manifests = await Promise.all(
    input.depots.map(({ depotId, manifestId }) =>
      readManifest(input.steamPath, depotId, manifestId),
    ),
  );

  // merged in mount order, so a later depot's file replaces an earlier one at the same path
  const files = new Map<string, IDepotFile>();
  const manifestCreatedAt: Record<string, number | null> = {};
  for (const [index, { manifest, createdAt }] of manifests.entries()) {
    const { depotId, manifestId } = input.depots[index]!;
    manifestCreatedAt[`${depotId}_${manifestId}`] = createdAt;
    for (const file of manifest.files) {
      if ((file.flags & DEPOT_FLAG.directory) === 0) {
        files.set(pathKey(file.name), file);
      }
    }
  }
  return { files, manifestCreatedAt };
}
