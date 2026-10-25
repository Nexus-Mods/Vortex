/**
 * Dev-only PoC: the disk side of the Steam game folder check. Reads Steam's depot manifests and
 * Vortex's deployment manifests, walks the game folder and hashes base game files, sampled or
 * whole (see FolderCheckMode). Never writes.
 * See docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, open, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type {
  FolderCheckInput,
  FolderCheckMode,
  FolderCheckResult,
  FolderCheckStatus,
} from "@vortex/shared/ipc";

import { log } from "../logging";
import {
  classify,
  type IClassified,
  type IDeployedEntry,
  type IDiskFile,
  mergeDepotFiles,
} from "./classify";
import {
  type IDepotChunk,
  type IDepotFile,
  type IDepotManifest,
  readDepotManifest,
} from "./depotManifest";

type RunningStatus = Extract<FolderCheckStatus, { state: "running" }>;

/** The folder can't be judged: there's no baseline to compare it with. */
export class FolderCheckUnavailable extends Error {}

const HASH_CONCURRENCY = 4;
// byte patches target these, anywhere in the file, so a sample isn't enough
const HASH_WHOLE = /\.(exe|dll)$/i;
const SAMPLED_CHUNKS = 4;
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
  files?: { relPath?: unknown; target?: string; time: number }[];
}

function asDeploymentManifest(value: unknown): IDeploymentManifestFile {
  return typeof value === "object" && value !== null ? value : {};
}

const insideRoot = (root: string, target: string): boolean => {
  const relPath = path.relative(root, target);
  return !relPath.startsWith("..") && !path.isAbsolute(relPath);
};

export async function readDeployments(root: string, disk: IDiskFile[]): Promise<IDeployedEntry[]> {
  const result: IDeployedEntry[] = [];
  for (const file of disk) {
    if (!DEPLOYMENT_MANIFEST.test(path.basename(file.relPath))) continue;
    const jsonPath = path.join(root, file.relPath);
    let manifest: IDeploymentManifestFile;
    try {
      manifest = asDeploymentManifest(JSON.parse(await readFile(jsonPath, "utf8")));
    } catch (err) {
      // one bad manifest shouldn't fail the check; its files show up as unknown
      log("warn", "Steam folder check skipped a deployment manifest", {
        jsonPath,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    // the manifest sits in its own target folder, so fall back to that when targetPath
    // names the same folder by another route (a junction or subst drive)
    const targetPath =
      manifest.targetPath !== undefined && insideRoot(root, manifest.targetPath)
        ? manifest.targetPath
        : path.dirname(jsonPath);
    for (const entry of manifest.files ?? []) {
      if (typeof entry.relPath !== "string") continue;
      const full = path.join(targetPath, entry.target ?? "", entry.relPath);
      if (!insideRoot(root, full)) continue;
      result.push({ relPath: path.relative(root, full), time: entry.time });
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

type HashItem = IClassified["toHash"][number];

/**
 * The chunks a quick check reads: first, last and two between, or none when the file should be
 * hashed whole. Four chunks finds a replaced file, which almost always differs from its first
 * chunk, at a few MB per file instead of the whole game.
 */
export function sampleChunks(item: HashItem, mode: FolderCheckMode): IDepotChunk[] {
  const { chunks } = item;
  if (mode === "full" || HASH_WHOLE.test(item.relPath) || chunks.length <= SAMPLED_CHUNKS) {
    return [];
  }
  const count = chunks.length;
  const picks = new Set([0, Math.floor(count / 3), Math.floor((2 * count) / 3), count - 1]);
  return [...picks].flatMap((index) => chunks[index] ?? []);
}

/** True when every chunk's bytes on disk match its SHA1 */
async function chunksMatch(filePath: string, chunks: IDepotChunk[]): Promise<boolean> {
  const handle = await open(filePath, "r");
  try {
    for (const chunk of chunks) {
      const buffer = Buffer.alloc(chunk.size);
      await handle.read(buffer, 0, chunk.size, chunk.offset);
      if (createHash("sha1").update(buffer).digest("hex") !== chunk.sha1) return false;
    }
    return true;
  } finally {
    await handle.close();
  }
}

export async function runFolderCheck(
  input: FolderCheckInput,
  onProgress: (status: RunningStatus) => void,
  mode: FolderCheckMode = "quick",
  hash: (filePath: string) => Promise<string> = sha1File,
): Promise<FolderCheckResult> {
  onProgress({ state: "running", phase: "listing", bytesDone: 0, bytesTotal: 0 });
  const base = await loadBaseFiles(input);
  const disk = await walkFolder(input.gamePath);
  const deployed = await readDeployments(input.gamePath, disk);
  const classified = classify(disk, base, deployed);

  const byRelPath = new Map(classified.files.map((file) => [file.relPath, file]));
  const unreadable: string[] = [];
  const queue = classified.toHash.map((item) => {
    const chunks = sampleChunks(item, mode);
    const bytes = chunks.length > 0 ? chunks.reduce((sum, c) => sum + c.size, 0) : item.size;
    return { item, chunks, bytes };
  });
  const bytesTotal = queue.reduce((sum, entry) => sum + entry.bytes, 0);
  let bytesDone = 0;
  onProgress({ state: "running", phase: "hashing", bytesDone, bytesTotal });

  const worker = async (): Promise<void> => {
    for (let entry = queue.shift(); entry !== undefined; entry = queue.shift()) {
      const { item, chunks, bytes } = entry;
      const filePath = path.join(input.gamePath, item.relPath);
      try {
        const matches =
          chunks.length > 0
            ? await chunksMatch(filePath, chunks)
            : (await hash(filePath)) === item.sha1;
        const file = byRelPath.get(item.relPath);
        if (!matches && file !== undefined) file.modified = true;
      } catch {
        unreadable.push(item.relPath);
      }
      bytesDone += bytes;
      onProgress({ state: "running", phase: "hashing", bytesDone, bytesTotal });
    }
  };
  await Promise.all(Array.from({ length: HASH_CONCURRENCY }, worker));

  return {
    checkedAt: Date.now(),
    input,
    mode,
    files: classified.files,
    missing: classified.missing,
    unreadable,
    baseFilesWithBackup: classified.baseFilesWithBackup,
  };
}
