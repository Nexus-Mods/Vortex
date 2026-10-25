/**
 * Dev-only PoC: sorts the files in a Steam game folder into game, Vortex and unknown, against
 * Steam's depot manifests and Vortex's deployment manifests. Pure; the disk work is in scan.ts.
 * See docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md.
 */
import type { FolderCheckFile } from "@vortex/shared/ipc";

import {
  DEPOT_FLAG,
  type IDepotChunk,
  type IDepotFile,
  type IDepotManifest,
} from "./depotManifest";

export interface IDiskFile {
  /** Relative to the game folder */
  relPath: string;
  size: number;
  mtimeMs: number;
  isSymlink: boolean;
}

export interface IDeployedEntry {
  /** Relative to the game folder */
  relPath: string;
  /** mtime Vortex recorded at deployment */
  time: number;
}

export interface IClassified {
  files: FolderCheckFile[];
  missing: { relPath: string; size: number }[];
  /** Base game files whose size matches, still to be compared by SHA1 */
  toHash: { relPath: string; sha1: string; size: number; chunks: IDepotChunk[] }[];
  baseFilesWithBackup: number;
}

const BACKUP_SUFFIX = ".vortex_backup";
const DEPLOYMENT_MANIFEST = /^vortex\.deployment.*\.json$/i;
const FOLDER_MARKER = "__folder_managed_by_vortex";

// files the game or user is expected to change, or links; Steam's verify doesn't restore these
const NOT_COMPARED = DEPOT_FLAG.userConfig | DEPOT_FLAG.versionedUserConfig | DEPOT_FLAG.symlink;

/** Steam and the game treat paths case-insensitively with Windows separators. */
export function pathKey(relPath: string): string {
  return relPath.replace(/\//g, "\\").toLowerCase();
}

export function mergeDepotFiles(manifests: IDepotManifest[]): Map<string, IDepotFile> {
  const result = new Map<string, IDepotFile>();
  for (const manifest of manifests) {
    for (const file of manifest.files) {
      if ((file.flags & DEPOT_FLAG.directory) === 0) {
        result.set(pathKey(file.name), file);
      }
    }
  }
  return result;
}

function isVortexOwnFile(key: string): boolean {
  const name = key.slice(key.lastIndexOf("\\") + 1);
  return DEPLOYMENT_MANIFEST.test(name) || name === FOLDER_MARKER || key.endsWith(BACKUP_SUFFIX);
}

export function classify(
  disk: IDiskFile[],
  base: Map<string, IDepotFile>,
  deployed: IDeployedEntry[],
): IClassified {
  const deployedByKey = new Map(deployed.map((entry) => [pathKey(entry.relPath), entry]));
  const diskKeys = new Set(disk.map((file) => pathKey(file.relPath)));
  const result: IClassified = { files: [], missing: [], toHash: [], baseFilesWithBackup: 0 };

  for (const file of disk) {
    const key = pathKey(file.relPath);
    const entry: FolderCheckFile = {
      relPath: file.relPath,
      size: file.size,
      mtimeMs: file.mtimeMs,
      bucket: "unknown",
    };

    const deployedEntry = deployedByKey.get(key);
    const baseEntry = base.get(key);
    if (deployedEntry !== undefined || isVortexOwnFile(key)) {
      entry.bucket = "vortex";
      // same test purge uses (isDeployedFile in activationStore.ts), inverted
      if (
        deployedEntry !== undefined &&
        !file.isSymlink &&
        Math.abs(file.mtimeMs - deployedEntry.time) >= 1000
      ) {
        entry.changedSinceDeployed = true;
      }
    } else if (baseEntry !== undefined) {
      entry.bucket = "game";
      const compared = (baseEntry.flags & NOT_COMPARED) === 0 && baseEntry.linkTarget === "";
      if (compared && baseEntry.size !== file.size) {
        entry.modified = true;
      } else if (compared && baseEntry.sha1 !== "") {
        result.toHash.push({
          relPath: file.relPath,
          sha1: baseEntry.sha1,
          size: file.size,
          chunks: baseEntry.chunks,
        });
      }
    }

    result.files.push(entry);
  }

  for (const [key, file] of base) {
    if (!diskKeys.has(key)) {
      result.missing.push({ relPath: file.name, size: file.size });
    }
    if (diskKeys.has(key + BACKUP_SUFFIX)) {
      result.baseFilesWithBackup++;
    }
  }

  return result;
}
