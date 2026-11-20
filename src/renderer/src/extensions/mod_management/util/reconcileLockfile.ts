import { type FileSource, type Lockfile } from "@nexusmods/mod-pipeline";
import { unknownToError } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";

import { entryIdOf } from "./diskScan";

/** Why a lockfile's deployed file no longer matches what was deployed there. */
export const ReconcileChange = {
  /** There is no file at game folder */
  DestinationMissing: "missing",
  /** File at game folder isn't that hardlink anymore: a copy */
  DestinationReplaced: "replaced",
  /** Still the same hardlink, but the content in staging changed */
  StagedContentChanged: "content-changed",
  /** File at staging is missing, redownload if possible */
  StagedMissing: "staged",
  /** Error reading destination file */
  DestinationError: "destination-error",
  /** Error while accessing a staged file */
  StagedError: "staged-error",
} as const;
export type ReconcileChange = (typeof ReconcileChange)[keyof typeof ReconcileChange];

export interface ReconcileResult {
  file: FileSource;
  change: ReconcileChange;
  error?: Error;
}

/**
 * The idea behind this function is that it takes a previous lockfile and tries to figure out were any files
 * changed in game folder or edited in place in staging. Based on the result we can bring those files in staging
 * and/or trigger the ECD.
 * Inputs:
 *  1. previous lockfile
 *  2. function that returns a path from staging by file hash
 *
 *  Does not throw.
 */
export async function reconcileLockfile(
  lockfile: Lockfile,
  getFileByHash: (hash: string) => Promise<QualifiedPath | undefined>,
): Promise<ReconcileResult[]> {
  const changedFiles: ReconcileResult[] = [];
  for (const file of lockfile.files) {
    const destinationFile = QualifiedPath.fromNative(file.destinationPath);
    const stagedFilePath = await getFileByHash(file.fileHash);

    try {
      let stagedFileId: string | undefined = undefined;

      const stagedStatus = await window.api.fs.stat(stagedFilePath, { parseSymLink: true });
      if (!stagedStatus.exists) {
        changedFiles.push({ file, change: ReconcileChange.StagedMissing });
        continue;
      }
      stagedFileId = entryIdOf(stagedStatus);

      try {
        const destinationStatus = await window.api.fs.stat(destinationFile, { parseSymLink: true });
        if (!destinationStatus.exists) {
          changedFiles.push({ file, change: ReconcileChange.DestinationMissing });
          continue;
        }

        const hardlinkChanged =
          stagedFileId === undefined || entryIdOf(destinationStatus) !== stagedFileId;
        if (hardlinkChanged) {
          changedFiles.push({ file, change: ReconcileChange.DestinationReplaced });
          continue;
        }
      } catch (err) {
        changedFiles.push({
          file,
          change: ReconcileChange.DestinationError,
          error: unknownToError(err),
        });
        continue;
      }

      // nothing recorded to compare against, e.g. a generated file: can't tell, so don't flag it
      if (
        file.stageModifiedTime !== undefined &&
        !stagedStatus.modifiedTime.equals(file.stageModifiedTime)
      ) {
        changedFiles.push({ file, change: ReconcileChange.StagedContentChanged });
      }
    } catch (err) {
      changedFiles.push({ file, change: ReconcileChange.StagedError, error: unknownToError(err) });
    }
  }

  return changedFiles;
}
