/**
 * Dev-only PoC: the disk side of the Steam game folder check. Reads Steam's depot manifests and
 * Vortex's deployment manifests, walks the game folder and hashes base game files. Never writes.
 * See docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { FolderCheckInput, FolderCheckResult, FolderCheckStatus } from "@vortex/shared/ipc";

import { classify, type IDeployedEntry, type IDiskFile, mergeDepotFiles } from "./classify";
import { type IDepotFile, type IDepotManifest, readDepotManifest } from "./depotManifest";

type RunningStatus = Extract<FolderCheckStatus, { state: "running" }>;

/** The folder can't be judged: there's no baseline to compare it with. */
export class FolderCheckUnavailable extends Error {}

const HASH_CONCURRENCY = 4;
const DEPLOYMENT_MANIFEST = /^vortex\.deployment.*\.json$/i;

export function depotManifestPath(steamPath: string, depotId: number, manifestId: string): string {
  return path.join(steamPath, "depotcache", `${depotId}_${manifestId}.manifest`);
}

export async function loadBaseFiles(input: FolderCheckInput): Promise<Map<string, IDepotFile>> {
  const manifests: IDepotManifest[] = [];
  for (const { depotId, manifestId } of input.depots) {
    let data: Buffer;
    try {
      data = await readFile(depotManifestPath(input.steamPath, depotId, manifestId));
    } catch {
      throw new FolderCheckUnavailable(
        `Steam's file list for depot ${depotId} (manifest ${manifestId}) isn't on disk`,
      );
    }
    let manifest: IDepotManifest;
    try {
      manifest = readDepotManifest(data);
    } catch {
      throw new FolderCheckUnavailable(`Steam's file list for depot ${depotId} couldn't be read`);
    }
    if (manifest.filenamesEncrypted) {
      throw new FolderCheckUnavailable(`Steam's file list for depot ${depotId} is encrypted`);
    }
    manifests.push(manifest);
  }
  return mergeDepotFiles(manifests);
}

export async function walkFolder(root: string): Promise<IDiskFile[]> {
  const result: IDiskFile[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        const stats = await lstat(full);
        result.push({
          relPath: path.relative(root, full),
          size: stats.size,
          mtimeMs: stats.mtimeMs,
          isSymlink: stats.isSymbolicLink(),
        });
      }
    }
  };
  await walk(root);
  return result;
}

interface IDeploymentManifestFile {
  targetPath?: string;
  files?: { relPath: string; target?: string; time: number }[];
}

export async function readDeployments(root: string, disk: IDiskFile[]): Promise<IDeployedEntry[]> {
  const result: IDeployedEntry[] = [];
  for (const file of disk) {
    if (!DEPLOYMENT_MANIFEST.test(path.basename(file.relPath))) continue;
    const jsonPath = path.join(root, file.relPath);
    const manifest: IDeploymentManifestFile = JSON.parse(await readFile(jsonPath, "utf8"));
    const targetPath = manifest.targetPath ?? path.dirname(jsonPath);
    for (const entry of manifest.files ?? []) {
      const relPath = path.relative(root, path.join(targetPath, entry.target ?? "", entry.relPath));
      if (relPath.startsWith("..") || path.isAbsolute(relPath)) continue;
      result.push({ relPath, time: entry.time });
    }
  }
  return result;
}

export function sha1File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha1");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

export async function runFolderCheck(
  input: FolderCheckInput,
  onProgress: (status: RunningStatus) => void,
  hash: (filePath: string) => Promise<string> = sha1File,
): Promise<FolderCheckResult> {
  onProgress({ state: "running", phase: "listing", bytesDone: 0, bytesTotal: 0 });
  const base = await loadBaseFiles(input);
  const disk = await walkFolder(input.gamePath);
  const deployed = await readDeployments(input.gamePath, disk);
  const classified = classify(disk, base, deployed);

  const byRelPath = new Map(classified.files.map((file) => [file.relPath, file]));
  const unreadable: string[] = [];
  const bytesTotal = classified.toHash.reduce((sum, item) => sum + item.size, 0);
  let bytesDone = 0;
  onProgress({ state: "running", phase: "hashing", bytesDone, bytesTotal });

  const queue = [...classified.toHash];
  const worker = async (): Promise<void> => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      try {
        const actual = await hash(path.join(input.gamePath, item.relPath));
        const file = byRelPath.get(item.relPath);
        if (actual !== item.sha1 && file !== undefined) file.modified = true;
      } catch {
        unreadable.push(item.relPath);
      }
      bytesDone += item.size;
      onProgress({ state: "running", phase: "hashing", bytesDone, bytesTotal });
    }
  };
  await Promise.all(Array.from({ length: HASH_CONCURRENCY }, worker));

  return {
    checkedAt: Date.now(),
    input,
    files: classified.files,
    missing: classified.missing,
    unreadable,
    baseFilesWithBackup: classified.baseFilesWithBackup,
  };
}
