/**
 * Combines Steam's file list, the folder listing and the verification into the state of the
 * folder when the game was managed. Where Vortex has deployed since, that state is rebuilt:
 * deployed files are left out, a deployed Steam file's backup stands in for the original,
 * and a deployed Steam path with no backup was missing.
 */
import path from "node:path";

import type {
  GameFolderFolderCount,
  GameFolderReportedFile,
  GameFolderCheckCounts,
  GameFolderFileCount,
  GameFolderFileKind,
  GameFolderFileReport,
} from "@vortex/shared/ipc";

import type { IBaseline } from "./baseline";
import type { IListing } from "./listing";
import { DEPLOYMENT_MANIFEST } from "./listing";
import { BACKUP_SUFFIX, type IVerification } from "./verify";

// LinkingDeployment tags the folders it creates; dot-prefixed off Windows, the old name in early versions
const FOLDER_MARKERS = new Set([
  "__folder_managed_by_vortex",
  ".__folder_managed_by_vortex",
  "__delete_if_empty",
]);
// the walk reports whole seconds, deployment manifests milliseconds
const DEPLOY_TIME_TOLERANCE_MS = 2000;

export interface IReconciled {
  counts: GameFolderCheckCounts;
  files: GameFolderFileReport[];
}

const zero = (): GameFolderFileCount => ({ files: 0, bytes: 0 });

function emptyCounts(verification: IVerification, fullVerify: boolean): GameFolderCheckCounts {
  return {
    steamFiles: {
      verified: zero(),
      sizeMatched: zero(),
      modified: zero(),
      missing: zero(),
      unreadable: zero(),
      notCompared: zero(),
      unchecked: zero(),
    },
    modifiedBy: { size: 0, sampled_chunk: 0, full_hash: 0 },
    sampleMissed: fullVerify ? 0 : null,
    fileSampleMissed: fullVerify ? 0 : null,
    hashSample: verification.hashSample,
    unknown: zero(),
    unknownInVortexFolder: zero(),
    vortex: zero(),
    vortexChangedSinceDeploy: zero(),
  };
}

const add = (count: GameFolderFileCount, bytes: number): void => {
  count.files++;
  count.bytes += bytes;
};

type SteamFileKind = Exclude<GameFolderFileKind, "unknown" | "vortex">;

const STEAM_COUNT: Record<SteamFileKind, keyof GameFolderCheckCounts["steamFiles"]> = {
  verified: "verified",
  size_matched: "sizeMatched",
  modified: "modified",
  missing: "missing",
  unreadable: "unreadable",
  not_compared: "notCompared",
  unchecked: "unchecked",
};

function reconcileSteamFiles(
  baseline: IBaseline,
  listing: IListing,
  verification: IVerification,
  counts: GameFolderCheckCounts,
  files: GameFolderFileReport[],
): void {
  for (const [key, file] of baseline.files) {
    const outcome = verification.outcomes.get(key) ?? { kind: "unchecked" as const };
    const hasBackup = listing.files.has(key + BACKUP_SUFFIX);
    const originalPresent = hasBackup || (listing.files.has(key) && !listing.deployed.has(key));

    let kind: SteamFileKind;
    let size = file.size;
    if (outcome.kind === "not_compared") {
      kind = "not_compared";
    } else if (!originalPresent) {
      kind = "missing";
    } else if (outcome.kind === "absent") {
      // the listing saw it, verification couldn't open it
      kind = "unreadable";
    } else {
      kind = outcome.kind;
    }

    const report: GameFolderFileReport = { relPath: file.name, kind, size };
    if (kind === "modified" && outcome.kind === "modified") {
      size = report.size = outcome.diskSize;
      report.detectedBy = outcome.by;
      if (hasBackup) report.fromBackup = true;
      counts.modifiedBy[outcome.by]++;
      if (outcome.chunkSampleWouldMiss && counts.sampleMissed !== null) counts.sampleMissed++;
      if (outcome.fileSampleWouldMiss && counts.fileSampleMissed !== null)
        counts.fileSampleMissed++;
    }
    add(counts.steamFiles[STEAM_COUNT[kind]], size);
    files.push(report);
  }
}

function isVortexOwnFile(relPath: string): boolean {
  const name = path.basename(relPath);
  return DEPLOYMENT_MANIFEST.test(name) || FOLDER_MARKERS.has(name.toLowerCase());
}

/** The folder part of a `pathKey`; "" for the game folder itself. */
const parentKey = (key: string): string => key.slice(0, Math.max(0, key.lastIndexOf("\\")));

/** Folders, as `pathKey`s, that hold a Vortex folder marker. */
function vortexFolders(listing: IListing): Set<string> {
  const folders = new Set<string>();
  for (const [key, file] of listing.files) {
    if (FOLDER_MARKERS.has(path.basename(file.relPath).toLowerCase())) folders.add(parentKey(key));
  }
  return folders;
}

/** Whether the file sits in a folder Vortex created, or anywhere below one. */
function inVortexFolder(key: string, folders: ReadonlySet<string>): boolean {
  if (folders.size === 0) return false;
  for (let folder = parentKey(key); ; folder = parentKey(folder)) {
    if (folders.has(folder)) return true;
    if (folder === "") return false;
  }
}

function reconcileOtherFiles(
  baseline: IBaseline,
  listing: IListing,
  counts: GameFolderCheckCounts,
  files: GameFolderFileReport[],
): void {
  const markedFolders = vortexFolders(listing);
  const addUnknown = (key: string, relPath: string, size: number): void => {
    add(counts.unknown, size);
    const report: GameFolderFileReport = { relPath, kind: "unknown", size };
    if (inVortexFolder(key, markedFolders)) {
      add(counts.unknownInVortexFolder, size);
      report.inVortexFolder = true;
    }
    files.push(report);
  };
  for (const [key, file] of listing.files) {
    const deployedAt = listing.deployed.get(key);
    if (deployedAt !== undefined) {
      const changed = Math.abs(file.mtimeMs - deployedAt) >= DEPLOY_TIME_TOLERANCE_MS;
      add(counts.vortex, file.size);
      if (changed) add(counts.vortexChangedSinceDeploy, file.size);
      files.push({
        relPath: file.relPath,
        kind: "vortex",
        size: file.size,
        changedSinceDeploy: changed,
      });
    } else if (baseline.files.has(key)) {
      // a Steam file, counted from Steam's list
    } else if (key.endsWith(BACKUP_SUFFIX)) {
      // a backup of a Steam file stands in for it; any other backup is a file the user had
      if (!baseline.files.has(key.slice(0, -BACKUP_SUFFIX.length))) {
        addUnknown(key, file.relPath, file.size);
      }
    } else if (isVortexOwnFile(file.relPath)) {
      add(counts.vortex, file.size);
      files.push({ relPath: file.relPath, kind: "vortex", size: file.size });
    } else {
      addUnknown(key, file.relPath, file.size);
    }
  }
}

export function reconcile(
  baseline: IBaseline,
  listing: IListing,
  verification: IVerification,
  fullVerify: boolean,
): IReconciled {
  const counts = emptyCounts(verification, fullVerify);
  const files: GameFolderFileReport[] = [];
  reconcileSteamFiles(baseline, listing, verification, counts, files);
  reconcileOtherFiles(baseline, listing, counts, files);
  return { counts, files };
}

const FOLDER_DEPTH = 2;

const slashPath = (relPath: string): string => relPath.split(/[\\/]/).join("/");

/** The first two folders a file sits in; "." for files at the top of the game folder. */
function folderOf(relPath: string): string {
  const folders = relPath.split(/[\\/]/).slice(0, -1);
  return folders.length === 0 ? "." : folders.slice(0, FOLDER_DEPTH).join("/");
}

/**
 * What is sent per file: every modified and missing file, and up to `maxUnknownPaths` unknown
 * ones picked at random, with every unknown file totalled by folder.
 */
export function reportedFiles(
  files: readonly GameFolderFileReport[],
  maxUnknownPaths: number,
  random: () => number,
): {
  files: GameFolderReportedFile[];
  unknownTruncated: boolean;
  unknownByFolder: GameFolderFolderCount[];
} {
  const reported: GameFolderReportedFile[] = [];
  const unknown: GameFolderFileReport[] = [];
  const byFolder = new Map<string, GameFolderFolderCount>();
  for (const file of files) {
    if (file.kind === "modified") {
      reported.push({
        path: slashPath(file.relPath),
        status: "modified",
        ...(file.detectedBy !== undefined && { detectedBy: file.detectedBy }),
        ...(file.fromBackup === true && { fromBackup: true as const }),
      });
    } else if (file.kind === "missing") {
      reported.push({ path: slashPath(file.relPath), status: "missing" });
    } else if (file.kind === "unknown") {
      unknown.push(file);
      const folder = folderOf(file.relPath);
      const count = byFolder.get(folder) ?? { folder, files: 0, bytes: 0 };
      count.files++;
      count.bytes += file.size;
      byFolder.set(folder, count);
    }
  }

  const take = Math.min(maxUnknownPaths, unknown.length);
  // partial Fisher-Yates: the first `take` entries end up a uniform sample
  for (let index = 0; index < take; index++) {
    const pick = index + Math.floor(random() * (unknown.length - index));
    [unknown[index], unknown[pick]] = [unknown[pick]!, unknown[index]!];
  }
  // sorted, so paths sharing folders sit together and compress well
  const sample = unknown
    .slice(0, take)
    .map((file) => ({
      path: slashPath(file.relPath),
      inVortexFolder: file.inVortexFolder === true,
    }))
    .toSorted((lhs, rhs) => (lhs.path < rhs.path ? -1 : lhs.path > rhs.path ? 1 : 0));
  for (const file of sample) {
    reported.push({
      path: file.path,
      status: "unknown",
      ...(file.inVortexFolder && { inVortexFolder: true as const }),
    });
  }
  return {
    files: reported,
    unknownTruncated: unknown.length > take,
    unknownByFolder: [...byFolder.values()],
  };
}
