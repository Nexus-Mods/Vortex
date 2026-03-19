import type { IEntry } from "turbowalk";

import {
  getErrorCode,
  isErrorWithSystemCode,
  unknownToError,
} from "@vortex/shared";
import PromiseBB from "bluebird";
import * as diskusage from "diskusage";
import * as path from "path";
import turbowalk from "turbowalk";
import * as winapi from "winapi-bindings";

import type { Normalize } from "./getNormalizeFunc";

import { DOWNLOADS_DIR_TAG } from "../extensions/download_management/util/downloadDirectory";
import { STAGING_DIR_TAG } from "../extensions/mod_management/stagingDirectory";
import {
  CleanupFailedException,
  InsufficientDiskSpace,
  NotFound,
  ProcessCanceled,
  UnsupportedOperatingSystem,
  UserCanceled,
} from "./CustomErrors";
import * as fs from "./fs";
import getNormalizeFunc from "./getNormalizeFunc";
import { log } from "./log";
import { isChildPath } from "./util";

const MIN_DISK_SPACE_OFFSET = 512 * 1024 * 1024;

/**
 * Test whether it is viable to transfer files and directories from
 *  a source directory to a new proposed destination directory.
 * Note:
 * - Currently will only test whether there's enough disk space at the destination
 *    folder.
 *
 * @param source The current source folder.
 * @param destination The proposed destination folder.
 */
export function testPathTransfer(
  source: string,
  destination: string,
): PromiseBB<void> {
  if (process.platform !== "win32") {
    return PromiseBB.reject(new UnsupportedOperatingSystem());
  }

  let destinationRoot: string;
  try {
    destinationRoot = winapi.GetVolumePathName(destination);
  } catch (err) {
    if (isErrorWithSystemCode(err)) {
      if (err.systemCode === 2) {
        return PromiseBB.reject(new NotFound(destination));
      }
    }

    return PromiseBB.reject(err);
  }

  const isOnSameVolume = (): PromiseBB<boolean> => {
    return PromiseBB.all([
      fs.statAsync(source),
      fs.statAsync(destinationRoot),
    ]).then((stats) => stats[0].dev === stats[1].dev);
  };

  const calculate = (filePath: string): PromiseBB<number> => {
    let total = 0;
    return turbowalk(
      filePath,
      (entries) => {
        const files = entries.filter((entry) => !entry.isDirectory);
        total += files.reduce((lhs, rhs) => lhs + rhs.size, 0);
      },
      { skipHidden: false },
    ).then(() => PromiseBB.resolve(total));
  };

  let totalNeededBytes = 0;
  return fs
    .statAsync(source)
    .catch((err) => {
      // We were unable to confirm the existence of the source directory!
      //  This is a valid use case when the source was a directory on
      //  a removable drive or network drive that is no longer there, or
      //  possibly a faulty HDD that was replaced.
      //  For that reason, we're going to skip disk calculations entirely.
      log(
        "warn",
        "Transfer disk space test failed - missing source directory",
        err,
      );
      return PromiseBB.reject(new ProcessCanceled("Missing source directory"));
    })
    .then(() => isOnSameVolume())
    .then((res) =>
      res
        ? PromiseBB.reject(
            new ProcessCanceled("Disk space calculations are unnecessary."),
          )
        : calculate(source),
    )
    .then((totalSize) => {
      totalNeededBytes = totalSize;
      try {
        return diskusage.check(destinationRoot);
      } catch (err) {
        // don't report an error just because this check failed
        return PromiseBB.resolve({ free: Number.MAX_VALUE });
      }
    })
    .then((res) =>
      totalNeededBytes < res.free - MIN_DISK_SPACE_OFFSET
        ? PromiseBB.resolve()
        : PromiseBB.reject(new InsufficientDiskSpace(destinationRoot)),
    )
    .catch(ProcessCanceled, () => PromiseBB.resolve());
}

export type ProgressCallback = (
  from: string,
  to: string,
  percentage: number,
) => void;

/**
 * Move the content of a directory to another - Using a move operation if it's on the same
 * drive and a copy+delete if not.
 * This works around or properly reports common problems, like when the destination directory
 * is a parent of the source directory
 * @param source
 * @param dest
 */
export function transferPath(
  source: string,
  dest: string,
  progress: ProgressCallback,
): PromiseBB<void> {
  let func = fs.copyAsync;

  let completed: number = 0;
  let count: number = 0;
  let lastPerc: number = 0;
  let lastProgress: number = 0;

  let copyPromise = PromiseBB.resolve();

  // Used to keep track of leftover empty directories when
  //  the user moves the directory to a nested one
  const removableDirectories: string[] = [];

  let exception: Error;

  let normalize: Normalize;
  let moveDown: boolean;

  let isCancelled: boolean = false;

  const showDialogCallback = () => {
    return !isCancelled;
  };

  const longestFirst = (lhs: IEntry, rhs: IEntry) =>
    rhs.filePath.length - lhs.filePath.length;

  return getNormalizeFunc(dest)
    .then((norm) => {
      normalize = norm;
      if (norm(dest) === norm(source)) {
        return PromiseBB.reject(
          new ProcessCanceled("Source and Destination are the same"),
        );
      }
      moveDown = isChildPath(dest, source, norm);
    })
    .then(() =>
      PromiseBB.join(
        fs.statAsync(source),
        fs.statAsync(dest),
        (statOld: fs.Stats, statNew: fs.Stats) =>
          PromiseBB.resolve(statOld.dev === statNew.dev),
      ),
    )
    .then((sameVolume: boolean) => {
      func = sameVolume ? linkFile : fs.copyAsync;
      return PromiseBB.resolve();
    })
    .then(() =>
      turbowalk(
        source,
        (entries: IEntry[]) => {
          if (moveDown) {
            // when moving files into a subdirectory from where they were, the
            // walk function may come across the directory that we're moving into.
            // obviously we don't want to copy _that_
            entries = entries.filter(
              (entry) =>
                entry.filePath !== dest &&
                !isChildPath(entry.filePath, dest, normalize),
            );
          }

          const directories = entries.filter((entry) => entry.isDirectory);
          const files = entries.filter((entry) => !entry.isDirectory);

          count += files.length;

          copyPromise = isCancelled
            ? PromiseBB.resolve()
            : copyPromise
                .then(() =>
                  PromiseBB.each(directories.sort(longestFirst), (entry) => {
                    if (moveDown && isChildPath(dest, entry.filePath)) {
                      // this catches the case where we transfer .../mods to .../mods/foo/bar
                      // and we come across the path .../mods/foo. Wouldn't want to try to remove
                      // that, do we?
                      return PromiseBB.resolve();
                    }
                    removableDirectories.push(entry.filePath);
                    const destPath = path.join(
                      dest,
                      path.relative(source, entry.filePath),
                    );
                    return isCancelled
                      ? PromiseBB.reject(new UserCanceled())
                      : fs
                          .ensureDirWritableAsync(destPath)
                          .catch((err) =>
                            getErrorCode(err) === "EEXIST"
                              ? PromiseBB.resolve()
                              : PromiseBB.reject(err),
                          );
                  }).then(() => {}),
                )
                .then(() =>
                  PromiseBB.map(files, (entry) => {
                    const sourcePath = entry.filePath;
                    const destPath = path.join(
                      dest,
                      path.relative(source, entry.filePath),
                    );

                    return func(sourcePath, destPath, { showDialogCallback })
                      .catch(UserCanceled, () => {
                        isCancelled = true;
                        copyPromise = PromiseBB.resolve();
                      })
                      .catch((err) => {
                        // EXDEV implies we tried to rename when source and destination are
                        //  not in fact on the same volume. This is what comparing the stat.dev
                        //  was supposed to prevent.
                        // ENOTSUP implies that we attempted to hardlink a file on a file system
                        //  which does not support it - copy instead.
                        // EISDIR is reported in node 12 if hardlinks aren't supported on the drive
                        //  come on...
                        const code = getErrorCode(err);
                        if (
                          code &&
                          ["EXDEV", "ENOTSUP", "EISDIR"].indexOf(code) !== -1
                        ) {
                          func = fs.copyAsync;
                          return func(sourcePath, destPath, {
                            showDialogCallback,
                          });
                        } else if (code === "ENOENT") {
                          return PromiseBB.resolve();
                        } else {
                          return PromiseBB.reject(err);
                        }
                      })
                      .then(() => {
                        ++completed;
                        const perc = Math.floor((completed * 100) / count);
                        if (
                          perc !== lastPerc ||
                          Date.now() - lastProgress > 1000
                        ) {
                          lastPerc = perc;
                          lastProgress = Date.now();
                          progress(sourcePath, destPath, perc);
                        }
                      });
                  })
                    .then(() => {})
                    .catch((err) => {
                      exception = unknownToError(err);
                    }),
                );
        },
        { details: false, skipHidden: false },
      ),
    )
    .then(() =>
      copyPromise.then(() =>
        exception !== undefined
          ? PromiseBB.reject(exception)
          : PromiseBB.resolve(),
      ),
    )
    .then(() => {
      const cleanUp = () => {
        return moveDown
          ? removeFolderTags(source).then(() =>
              removeOldDirectories(removableDirectories),
            )
          : fs.removeAsync(source);
      };

      return cleanUp().catch((unknownError) => {
        const err = unknownToError(unknownError);
        // We're in the cleanup process. Regardless of whatever happens
        //  at this point, the transfer has completed successfully!
        //  We log the error and report an exception but expect the caller
        //  to resolve successfully and inform the user that we couldn't clean
        //  up properly.
        log(
          "error",
          "Failed to remove source directory",
          err.stack !== undefined ? err.stack : err,
        );

        return PromiseBB.reject(new CleanupFailedException(err));
      });
    });
}

/**
 * Will sort all detected file paths in respect to length (longest first)
 *  and will remove every file and directory one at a time.
 *  Yet again rimraf can't be trusted to deal with a basic piece of
 *  functionality like deleting a directory recursively.
 *  https://github.com/Nexus-Mods/Vortex/issues/6769
 * @param dirPath
 */
export function cleanFailedTransfer(dirPath: string): PromiseBB<void> {
  let files: IEntry[] = [];
  return turbowalk(
    dirPath,
    (entries) => {
      files = files.concat(entries);
    },
    { skipHidden: false, skipLinks: false, recurse: true },
  )
    .catch((err) => {
      const code = getErrorCode(err);
      return code && ["ENOENT", "ENOTFOUND"].includes(code)
        ? PromiseBB.resolve()
        : PromiseBB.reject(err);
    })
    .then(() => {
      files = files.sort(
        (lhs, rhs) => rhs.filePath.length - lhs.filePath.length,
      );
      return PromiseBB.each(files, (file) => fs.removeAsync(file.filePath));
    })
    .then(() => fs.removeAsync(dirPath));
}

function removeFolderTags(sourceDir: string) {
  // Attempt to remove the folder tag. (either staging folder or downloads tag)
  //  This should only be called when the folder is moved down a layer.
  const tagFileExists = (filePath: string): PromiseBB<boolean> => {
    return fs
      .statAsync(filePath)
      .then(() => true)
      .catch(() => false);
  };

  const removeTag = (filePath: string): PromiseBB<void> => {
    return tagFileExists(filePath).then((exists) =>
      exists
        ? fs.removeAsync(filePath).catch((err) => {
            log("error", "Unable to remove directory tag", err);
            return getErrorCode(err) === "ENOENT"
              ? // Tag file is gone ? no problem.
                PromiseBB.resolve()
              : PromiseBB.reject(err);
          })
        : PromiseBB.resolve(),
    );
  };

  const stagingFolderTag = path.join(sourceDir, STAGING_DIR_TAG);
  const downloadsTag = path.join(sourceDir, DOWNLOADS_DIR_TAG);
  return PromiseBB.all([removeTag(stagingFolderTag), removeTag(downloadsTag)]);
}

function removeOldDirectories(directories: string[]): PromiseBB<void> {
  const longestFirst = (lhs, rhs) => rhs.length - lhs.length;
  return PromiseBB.each(directories.sort(longestFirst), (dir) =>
    fs.removeAsync(dir).catch((err) => {
      return getErrorCode(err) === "ENOENT"
        ? // Directory missing ? odd but lets keep going.
          PromiseBB.resolve()
        : PromiseBB.reject(err);
    }),
  ).then(() => PromiseBB.resolve());
}

function linkFile(
  source: string,
  dest: string,
  options?: fs.ILinkFileOptions,
): PromiseBB<void> {
  return fs.ensureDirAsync(path.dirname(dest)).then(() => {
    return fs
      .linkAsync(source, dest, options)
      .catch((err) =>
        getErrorCode(err) !== "EEXIST"
          ? PromiseBB.reject(err)
          : PromiseBB.resolve(),
      );
  });
}
