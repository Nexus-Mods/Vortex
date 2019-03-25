import { InsufficientDiskSpace, NotFound, ProcessCanceled,
         UnsupportedOperatingSystem } from './CustomErrors';
import * as fs from './fs';
import getNormalizeFunc, { Normalize } from './getNormalizeFunc';
import { log } from './log';
import { isChildPath } from './util';

import * as Promise from 'bluebird';
import * as diskusage from 'diskusage';
import * as path from 'path';
import turbowalk, { IEntry } from 'turbowalk';
import * as winapi from 'winapi-bindings';
import { STAGING_DIR_TAG } from '../extensions/mod_management/eventHandlers';

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
export function testPathTransfer(source: string, destination: string): Promise<void> {
  if (process.platform !== 'win32') {
    return Promise.reject(new UnsupportedOperatingSystem());
  }

  let destinationRoot: string;
  try {
    destinationRoot = winapi.GetVolumePathName(destination);
  } catch (err) {
    // On Windows, error number 2 (0x2) translates to ERROR_FILE_NOT_FOUND.
    //  the only way for this error to be reported at this point is when
    //  the destination path is pointing towards a non-existing partition.
    return (err.errno === 2)
      ? Promise.reject(new NotFound(err.path))
      : Promise.reject(err);
  }

  const isOnSameVolume = (): Promise<boolean> => {
    return Promise.all([fs.statAsync(source), fs.statAsync(destinationRoot)])
      .then(stats => stats[0].dev === stats[1].dev);
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
    .then(res => res
      ? Promise.reject(new ProcessCanceled('Disk space calculations are unnecessary.'))
      : calculate(source))
    .then(totalSize => {
      totalNeededBytes = totalSize;
      try {
        return diskusage.check(destinationRoot);
      } catch (err) {
        // don't report an error just because this check failed
        return Promise.resolve({ free: Number.MAX_VALUE });
      }
    })
    .then(res =>
      (totalNeededBytes < (res.free - MIN_DISK_SPACE_OFFSET))
        ? Promise.resolve()
        : Promise.reject(new InsufficientDiskSpace(destinationRoot)))
    .catch(ProcessCanceled, () => Promise.resolve());
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
                             progress: ProgressCallback): Promise<void> {
  let func = fs.copyAsync;

  let completed: number = 0;
  let count: number = 0;
  let lastPerc: number = 0;
  let lastProgress: number = 0;

  let copyPromise = Promise.resolve();

  // Used to keep track of leftover empty directories when
  //  the user moves the directory to a nested one
  const removableDirectories: string[] = [];

  let exception: Error;

  let normalize: Normalize;
  let moveDown: boolean;

  return getNormalizeFunc(dest)
    .then(norm => {
      normalize = norm;
      moveDown = isChildPath(dest, source, norm);
    })
    .then(() => Promise.join(fs.statAsync(source), fs.statAsync(dest),
      (statOld: fs.Stats, statNew: fs.Stats) =>
        Promise.resolve(statOld.dev === statNew.dev)))
    .then((sameVolume: boolean) => {
      func = sameVolume ? linkFile : fs.copyAsync;
      return Promise.resolve();
    })
    .then(() => turbowalk(source, (entries: IEntry[]) => {
      if (moveDown) {
        // when moving files into a subdirectory from where they were, the
        // walk function may come across the directory that we're moving into.
        // obviously we don't want to copy _that_
        entries = entries.filter(entry =>
          (entry.filePath !== dest) && !isChildPath(entry.filePath, dest, normalize));
      }

      const directories = entries.filter(entry => entry.isDirectory);
      const files = entries.filter(entry => !entry.isDirectory);

      count += files.length;

      copyPromise = copyPromise.then(() => Promise.map(directories, entry => {
        if (moveDown && isChildPath(dest, entry.filePath)) {
          // this catches the case where we transfer .../mods to .../mods/foo/bar
          // and we come across the path .../mods/foo. Wouldn't want to try to remove
          // that, do we?
          return Promise.resolve();
        }
        removableDirectories.push(entry.filePath);
        const destPath = path.join(dest, path.relative(source, entry.filePath));
        return fs.mkdirsAsync(destPath);
      })
        .then(() => null))
        .then(() => Promise.map(files, entry => {
          const sourcePath = entry.filePath;
          const destPath = path.join(dest, path.relative(source, entry.filePath));

          return func(sourcePath, destPath)
            .catch(err => {
              // EXDEV implies we tried to rename when source and destination are
              // not in fact on the same volume. This is what comparing the stat.dev
              // was supposed to prevent.
              if (err.code === 'EXDEV') {
                func = fs.copyAsync;
                return func(sourcePath, destPath);
              } else if (err.code === 'ENOENT') {
                return Promise.resolve();
              } else {
                return Promise.reject(err);
              }
            })
            .then(() => {
              ++completed;
              const perc = Math.floor((completed * 100) / count);
              if (perc !== lastPerc) {
                lastPerc = perc;
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
      ? Promise.reject(exception)
      : Promise.resolve()))
    .then(() => moveDown
      ? removeStagingTag(source).then(() => removeEmptyDirectories(removableDirectories))
      : fs.removeAsync(source))
    .catch(err => {
      if (['ENOENT', 'EPERM'].indexOf(err.code) !== -1) {
        // We shouldn't report failure just because we encountered
        //  a permissions issue or a missing folder.
        //  this is a very ugly workaround to the permissions issue
        //  we sometimes encounter due to file handles not being released.
        log('warn', 'Failed to remove source directory', err);
        return Promise.resolve();
      } else {
        return Promise.reject(err);
      }
    });
}

function removeStagingTag(sourceDir: string) {
  // Attempt to remove the staging folder tag.
  //  This should only be called when the staging folder is
  //  moved down a layer.
  return fs.removeAsync(path.join(sourceDir, STAGING_DIR_TAG))
    .catch(err => {
      if (err.code !== 'ENOENT') {
        // No point reporting this.
        log('error', 'Unable to remove staging directory tag', err);
      }
      return Promise.resolve();
    });
}

function removeEmptyDirectories(directories: string[]): Promise<void> {
  const longestFirst = (lhs, rhs) => rhs.length - lhs.length;
  return Promise.each(directories.sort(longestFirst), dir => fs.rmdirAsync(dir)
    .catch(err => {
      if (err.code === 'ENOTEMPTY') {
        // The directories parameter is expected to provide filePaths to
        //  empty directories! In this case, clearly something went wrong with
        //  the transfer!
        return Promise.reject(err);
      } else {
        // Something went wrong but we expect all transfers to have completed
        //  successfully at this point; we can't stop now as we have
        //  already started to clean-up the source directories, and reporting an
        //  error at this point would leave the user's transfer in a questionable state!
        log('warn', 'Failed to remove leftover empty directories', err);
        return Promise.resolve();
      }
    })).then(() => null);
}

function linkFile(source: string, dest: string): Promise<void> {
  return fs.ensureDirAsync(path.dirname(dest))
    .then(() => {
      return fs.linkAsync(source, dest)
        .catch(err => (err.code !== 'EEXIST')
          ? Promise.reject(err)
          : Promise.resolve());
  });
}
