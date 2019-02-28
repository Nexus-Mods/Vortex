import { InsufficientDiskSpace, ProcessCanceled,
         UnsupportedOperatingSystem } from './CustomErrors';
import * as fs from './fs';
import { isChildPath } from './util';
import { log } from './log';

import * as Promise from 'bluebird';
import * as diskusage from 'diskusage';
import * as path from 'path';
import turbowalk, { IEntry } from 'turbowalk';
import * as winapi from 'winapi-bindings';

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

  let destinationRoot;
  try {
    destinationRoot = winapi.GetVolumePathName(destination);
  } catch (err) {
    return Promise.reject(err);
  }

  const isOnSameVolume = (): Promise<boolean> => {
    return Promise.all([fs.statAsync(source), fs.statAsync(destinationRoot)])
      .then(stats => stats[0].dev === stats[1].dev);
  };

  const calculate = (filePath: string): Promise<number> => {
    let total = 0;
    return turbowalk(filePath, entries => {
      const files = entries.filter(entry => !entry.isDirectory);
      total = files.reduce((lhs, rhs) => lhs + rhs.size, 0);
    }).then(() => Promise.resolve(total));
  };

  let totalNeededBytes = 0;
  return isOnSameVolume()
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
  const moveDown = isChildPath(dest, source);

  let func = fs.copyAsync;

  let completed = 0;
  let count: number = 0;
  let lastPerc = 0;

  let copyPromise = Promise.resolve();

  // Used to keep track of leftover empty directories when
  //  the user moves the staging folder to a directory
  //  on the same volume.
  let removableDirectories: string[] = moveDown ? [] : undefined;

  const removeDirectories = (directories: string[]) => {
    return directories.forEach(dir => fs.removeAsync(dir)
      .catch(err => {
        if (err.code === 'ENOENT') {
          // Directory is missing - that's fine.
          return Promise.resolve();
        } else {
          // Something went wrong but we expect any transfers to be completed
          //  at this point, so we might as well just log this and keep going
          log('warn', `${err.code} - Cannot remove ${dir}`);
          return Promise.resolve();
        }
      }));
  }

  return Promise.join(fs.statAsync(source), fs.statAsync(dest),
    (statOld: fs.Stats, statNew: fs.Stats) =>
      Promise.resolve(statOld.dev === statNew.dev))
    .then((sameVolume: boolean) => {
      func = sameVolume ? fs.renameAsync : fs.copyAsync;
    })
    .then(() => turbowalk(source, (entries: IEntry[]) => {
      count += entries.length;
      copyPromise = copyPromise.then(() => Promise.map(entries, entry => {
        const sourcePath = entry.filePath;
        const destPath = path.join(dest, path.relative(source, entry.filePath));
        if (sourcePath === dest) {
          // if the target directory is a subdirectory of the old one, don't try
          // to move it into itself, that's just weird. Also it fails
          // (e.g. ...\mods -> ...\mods\newMods)
          return Promise.resolve();
        }

        if (entry.isDirectory) {
          if (removableDirectories !== undefined) {
            removableDirectories.push(entry.filePath);
          }
          return fs.mkdirsAsync(destPath);
        }

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
      }).then(() => null));
    }, { details: false, skipHidden: false }))
    .then(() => copyPromise)
    .then(() => moveDown
      ? removeDirectories(removableDirectories)
      : fs.removeAsync(source))
    .catch(err => (err.code === 'ENOENT')
      ? Promise.resolve()
      : Promise.reject(err));
}
