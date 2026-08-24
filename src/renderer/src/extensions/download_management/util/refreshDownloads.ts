import * as path from "path";

import { getErrorCode, VortexError } from "@vortex/shared";

import { log } from "../../../logging";
import { knownArchiveExt } from "../../../util/archives";
import * as fs from "../../../util/fs";

/**
 * Whether the folder is definitively absent. Any other stat failure is left
 * alone so ensureDirWritableAsync still gets its chance to fix permissions.
 */
async function folderIsMissing(downloadPath: string): Promise<boolean> {
  try {
    await fs.statAsync(downloadPath);
    return false;
  } catch (err: unknown) {
    return getErrorCode(err) === "ENOENT";
  }
}

/** archive files in the folder; read errors propagate */
async function readArchiveNames(downloadPath: string): Promise<string[]> {
  const entries: string[] = await fs.readdirAsync(downloadPath);
  const archives = entries.filter((fileName) => knownArchiveExt(fileName));
  const isFile = await Promise.all(
    archives.map((fileName) =>
      fs.statAsync(path.join(downloadPath, fileName)).then(
        (stat) => !stat.isDirectory(),
        () => false,
      ),
    ),
  );
  return archives.filter((_name, idx) => isFile[idx]);
}

/**
 * Reconciles the download database against the archives on disk: registers
 * archives that aren't in the database and removes records whose archive is
 * gone.
 */
export async function refreshDownloads(
  downloadPath: string,
  knownDLs: string[],
  normalize: (input: string) => string,
  onAddDownload: (name: string) => PromiseLike<void>,
  onRemoveDownload: (name: string) => PromiseLike<void>,
  confirmElevation: () => PromiseLike<void>,
): Promise<void> {
  // Never create the folder we are about to treat as the source of truth: with
  // records on file, an absent folder means unavailable, not emptied.
  if (knownDLs.length > 0 && (await folderIsMissing(downloadPath))) {
    throw new VortexError(`Download folder is not available: ${downloadPath}`, {
      kind: "fs:not-found",
      path: downloadPath,
    });
  }

  await fs.ensureDirWritableAsync(downloadPath, confirmElevation);
  const downloadNames = await readArchiveNames(downloadPath);

  const dlsNormalized = downloadNames.map(normalize);
  const addedDLs = downloadNames.filter((_name, idx) => !knownDLs.includes(dlsNormalized[idx]));
  const removedDLs = knownDLs.filter((name) => !dlsNormalized.includes(name));

  await Promise.all(addedDLs.map((name) => onAddDownload(name)));

  if (removedDLs.length === 0) {
    return;
  }

  // An empty read is the same signal by another route: a drive remounted blank,
  // or a path pointing somewhere new.
  if (downloadNames.length === 0) {
    log("error", "download folder read empty, keeping the download database", {
      downloadPath,
      keptRecords: removedDLs.length,
    });
    return;
  }

  log("info", "removing downloads whose archive is gone", {
    downloadPath,
    count: removedDLs.length,
    files: removedDLs,
  });
  await Promise.all(removedDLs.map((name) => onRemoveDownload(name)));
}
