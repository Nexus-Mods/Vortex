import { DOWNLOADS_DIR_TAG } from '../extensions/download_management/util/downloadDirectory';
import { STAGING_DIR_TAG } from '../extensions/mod_management/stagingDirectory';

import { CleanupFailedException, InsufficientDiskSpace, NotFound, ProcessCanceled,
         UnsupportedOperatingSystem, UserCanceled } from './CustomErrors';
import * as fs from './fs';
import getNormalizeFunc, { Normalize } from './getNormalizeFunc';
import { log } from './log';
import { isChildPath } from './util';

import Bluebird from 'bluebird';
import * as diskusage from 'diskusage';
import * as path from 'path';
import turbowalk, { IEntry } from 'turbowalk';
import * as winapi from 'winapi-bindings';

const MIN_DISK_SPACE_OFFSET = 512 * 1024 * 1024;

interface IDiskInfo {
  size?: number;
  free?: number;
}

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
export function testPathTransfer(source: string, destination: string): Bluebird<void> {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    return Bluebird.reject(new UnsupportedOperatingSystem());
  }

  let destinationRoot: string;
  try {
    destinationRoot = process.platform === 'win32'
      ? winapi.GetVolumePathName(destination)
      : path.parse(destination).root;
  } catch (err) {
    // On Windows, error number 2 (0x2) translates to ERROR_FILE_NOT_FOUND.
    //  the only way for this error to be reported at this point is when
    //  the destination path is pointing towards a non-existing partition.
    return (err.systemCode === 2)
      ? Bluebird.reject(new NotFound(err.path))
      : Bluebird.reject(err);
  }

  const isOnSameVolume = (): Promise<boolean> => {
    if (process.platform === 'win32') {
      return Promise.all([fs.statAsync(source), fs.statAsync(destinationRoot)])
        .then(stats => stats[0].dev === stats[1].dev);
    } else {
      // On macOS, compare the root paths
      const sourceRoot = path.parse(source).root;
      const destRoot = path.parse(destination).root;
      return Promise.resolve(sourceRoot === destRoot);
    }
  };

  const calculate = (filePath: string): Promise<number> => {
    let total = 0;
    return turbowalk(filePath, entries => {
      const files = entries.filter(entry => !entry.isDirectory);
      total += files.reduce((lhs, rhs) => lhs + rhs.size, 0);
    }, { skipHidden: false }).then(() => Promise.resolve(total));
  };

  let totalNeededBytes = 0;
  return fs.statAsync(source)
    .catch(err => {
      // We were unable to confirm the existence of the source directory!
      //  This is a valid use case when the source was a directory on
      //  a removable drive or network drive that is no longer there, or
      //  possibly a faulty HDD that was replaced.
      //  For that reason, we're going to skip disk calculations entirely.
      log('warn', 'Transfer disk space test failed - missing source directory', err);
      return Promise.reject(new ProcessCanceled('Missing source directory'));
    })
    .then(() => isOnSameVolume())
    .then((sameVolume: boolean): Bluebird<IDiskInfo> => {
      if (sameVolume) {
        // Same volume - no need to check disk space
        return Bluebird.resolve({ free: Number.MAX_VALUE });
      }
      return Bluebird.try(() => calculate(source)).then(size => ({ size }));
    })
    .then((info: IDiskInfo): Bluebird<IDiskInfo> => {
      if (info.free !== undefined) {
        // Same volume transfer - no need to check disk space
        return Bluebird.resolve(info);
      }
      totalNeededBytes = info.size;
      const checkPath = process.platform === 'win32' ? destinationRoot : path.dirname(destination);
      return Bluebird.resolve(diskusage.check(checkPath))
        .then(usage => {
          const requiredSpace = (info.size || 0) + MIN_DISK_SPACE_OFFSET;
          if (usage.free < requiredSpace) {
            return Bluebird.reject(new InsufficientDiskSpace(checkPath));
          }
          return Bluebird.resolve<IDiskInfo>({ free: usage.free });
        })
        .catch(err => {
          if (err instanceof InsufficientDiskSpace) {
            return Bluebird.reject(err);
          }
          // don't report an error just because this check failed
          log('warn', 'Failed to check disk space', err);
          return Bluebird.resolve<IDiskInfo>({ free: Number.MAX_VALUE });
        });
    })
    .then((info: IDiskInfo): Bluebird<void> => {
      const requiredSpace = totalNeededBytes + MIN_DISK_SPACE_OFFSET;
      if (info.free < requiredSpace) {
        const errorPath = process.platform === 'win32' ? destinationRoot : path.dirname(destination);
        return Bluebird.reject(new InsufficientDiskSpace(errorPath));
      }
      return Bluebird.resolve();
    })
    .catch(err => {
      if (err instanceof ProcessCanceled || err instanceof NotFound || err instanceof InsufficientDiskSpace) {
        return Bluebird.reject(err);
      }
      throw err;
    });
}

export type ProgressCallback = (from: string, to: string, percentage: number) => void;

/**
 * Move the content of a directory to another - Using a move operation if it's on the same
 * drive and a copy+delete if not.
 * This works around or properly reports common problems, like when the destination directory
 * is a parent of the source directory
 * @param source
 * @param dest
 */
export function transferPath(source: string,
                             dest: string,
                             progress: ProgressCallback): Bluebird<void> {
  let func = fs.copyAsync;

  let completed: number = 0;
  let count: number = 0;
  let lastPerc: number = 0;
  let lastProgress: number = 0;

  let copyPromise: Bluebird<void> = Bluebird.resolve();

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

  const longestFirst = (lhs: IEntry, rhs: IEntry) => rhs.filePath.length - lhs.filePath.length;

  return getNormalizeFunc(dest)
    .then(norm => {
      normalize = norm;
      if (norm(dest) === norm(source)) {
        return Promise.reject(new ProcessCanceled('Source and Destination are the same'));
      }
      moveDown = isChildPath(dest, source, norm);
    })
    .then(() => Bluebird.join(fs.statAsync(source), fs.statAsync(dest),
      (statOld: fs.Stats, statNew: fs.Stats) =>
        Bluebird.resolve(statOld.dev === statNew.dev)))
    .then((sameVolume: boolean) => {
      func = sameVolume ? linkFile : fs.copyAsync;
      return Bluebird.resolve();
    })
    .then(() => turbowalk(source, (entries: IEntry[]) => {
      if (moveDown) {
        entries = entries.filter(entry =>
          (entry.filePath !== dest) && !isChildPath(entry.filePath, dest, normalize));
      }

      const directories = entries.filter(entry => entry.isDirectory);
      const files = entries.filter(entry => !entry.isDirectory);

      count += files.length;

      copyPromise = isCancelled
        ? Bluebird.resolve()
        : copyPromise.then(() => Bluebird.each(directories.sort(longestFirst), entry => {
          if (moveDown && isChildPath(dest, entry.filePath)) {
            return Bluebird.resolve();
          }
          removableDirectories.push(entry.filePath);
          const destPath = path.join(dest, path.relative(source, entry.filePath));
          return isCancelled
            ? Bluebird.reject(new UserCanceled())
            : fs.ensureDirWritableAsync(destPath).catch(err => (err.code === 'EEXIST')
              ? Bluebird.resolve()
              : Bluebird.reject(err));
        })
        .then(() => null))
        .then(() => Bluebird.map(files, entry => {
          const sourcePath = entry.filePath;
          const destPath = path.join(dest, path.relative(source, entry.filePath));

          return func(sourcePath, destPath, { showDialogCallback })
            .catch(UserCanceled, () => {
              isCancelled = true;
              copyPromise = Bluebird.resolve();
            })
            .catch(err => {
              if (['EXDEV', 'ENOTSUP', 'EISDIR'].indexOf(err.code) !== -1) {
                func = fs.copyAsync;
                return func(sourcePath, destPath, { showDialogCallback });
              } else if (err.code === 'ENOENT') {
                return Bluebird.resolve();
              } else {
                return Bluebird.reject(err);
              }
            })
            .then(() => {
              ++completed;
              const perc = Math.floor((completed * 100) / count);
              if ((perc !== lastPerc) || ((Date.now() - lastProgress) > 1000)) {
                lastPerc = perc;
                lastProgress = Date.now();
                progress(sourcePath, destPath, perc);
              }
            });
        })
        .then(() => null)
        .catch(err => {
          exception = err;
          return null;
        }));
    }, { details: false, skipHidden: false }))
    .then(() => copyPromise.then(() => (exception !== undefined)
      ? Bluebird.reject(exception)
      : Bluebird.resolve()))
    .then(() => {
      const cleanUp = () => {
        return (moveDown)
          ? removeFolderTags(source).then(() => removeOldDirectories(removableDirectories))
          : fs.removeAsync(source);
      };

      return cleanUp()
        .catch(err => {
            // We're in the cleanup process. Regardless of whatever happens
            //  at this point, the transfer has completed successfully!
            //  We log the error and report an exception but expect the caller
            //  to resolve successfully and inform the user that we couldn't clean
            //  up properly.
            log('error', 'Failed to remove source directory',
              (err.stack !== undefined) ? err.stack : err);

            return Promise.reject(new CleanupFailedException(err));
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
export function cleanFailedTransfer(dirPath: string): Bluebird<void> {
  let files: IEntry[] = [];
  return turbowalk(dirPath, entries => {
    files = files.concat(entries);
  }, { skipHidden: false, skipLinks: false, recurse: true })
  .catch(err => (['ENOENT', 'ENOTFOUND'].includes(err.code))
    ? Bluebird.resolve()
    : Bluebird.reject(err))
  .then(() => {
    files = files.sort((lhs, rhs) => rhs.filePath.length - lhs.filePath.length);
    return Bluebird.each(files, file => fs.removeAsync(file.filePath));
  })
  .then(() => fs.removeAsync(dirPath));
}

function removeFolderTags(sourceDir: string) {
  // Attempt to remove the folder tag. (either staging folder or downloads tag)
  //  This should only be called when the folder is moved down a layer.
  const tagFileExists = (filePath: string): Bluebird<boolean> => {
    return Bluebird.try(() => fs.statAsync(filePath))
      .then(() => true)
      .catch(() => false);
  };

  const removeTag = (filePath: string): Bluebird<void> => {
    return tagFileExists(filePath)
      .then(exists => exists
        ? fs.removeAsync(filePath).catch(err => {
          log('error', 'Unable to remove directory tag', err);
          return (['ENOENT'].indexOf(err.code) !== -1)
            // Tag file is gone ? no problem.
            ? Bluebird.resolve()
            : Bluebird.reject(err);
        })
        : Bluebird.resolve());
  };

  const stagingFolderTag = path.join(sourceDir, STAGING_DIR_TAG);
  const downloadsTag = path.join(sourceDir, DOWNLOADS_DIR_TAG);
  return Bluebird.all([removeTag(stagingFolderTag), removeTag(downloadsTag)]).then(() => undefined);
}

function removeOldDirectories(items: IEntry[] | string[]): Bluebird<void> {
  const longestFirst = (lhs: string | IEntry, rhs: string | IEntry) => {
    const lPath = typeof lhs === 'string' ? lhs : lhs.filePath;
    const rPath = typeof rhs === 'string' ? rhs : rhs.filePath;
    return rPath.length - lPath.length;
  };

  const paths = items.map(item => typeof item === 'string' ? item : item.filePath);
  return Bluebird.each(paths.sort(longestFirst), path => 
    fs.removeAsync(path)
      .catch(err => (['ENOENT'].indexOf(err.code) !== -1)
        ? Bluebird.resolve()
        : Bluebird.reject(err))
  ).then(() => undefined);
}

  function exists(filePath: string): Bluebird<boolean> {
    return fs.statAsync(filePath)
      .then(() => true)
      .catch(() => false);
  }

function linkFile(source: string, dest: string, options?: any): Bluebird<void> {
  return fs.ensureDirAsync(path.dirname(dest))
    .then(() => fs.linkAsync(source, dest, options))
    .catch(err => (err.code !== 'EEXIST')
      ? Bluebird.reject(err)
      : Bluebird.resolve());
}
