import { IModEntry } from '../types/nmmEntries';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { log } from 'vortex-api';

/**
 * copy or move a list of mod archives
 * @param {string} modArchive
 * @param {string} destSavePath
 */
export function transferArchive(modArchivePath: string,
                                destSavePath: string): Promise<string> {
  let failedArchive: string = null;

  return fs.copyAsync(modArchivePath, path.join(destSavePath, path.basename(modArchivePath)))
  .catch(err => {
    failedArchive = modArchivePath + ' - ' + err.message;
  })
  .then(() => Promise.resolve(failedArchive));
}

function byLength(lhs: string, rhs: string): number {
  return lhs.length - rhs.length;
}

/**
 * copy or move a list of mod files
 * @param {ModEntry} mod
 * @param {string} nmmVirtualPath
 * @param {string} installPath
 * @param {boolean} keepSource
 */
export function transferUnpackedMod(mod: IModEntry, nmmVirtualPath: string,
                                    installPath: string, keepSource: boolean): Promise<string[]> {
  const operation = keepSource ? fs.copyAsync : fs.renameAsync;

  const destPath = path.join(installPath, mod.vortexId);

  // determine list of direcotries in the output directory. We create those
  // in a first step in the hope that this is faster than calling mkdirs
  // for each file individually
  const directories = new Set<string>();
  directories.add(destPath);
  mod.fileEntries.forEach(file => {
    directories.add(path.dirname(path.join(destPath, file.fileDestination)));
  });

  const failedFiles: string[] = [];
  return Promise.map(Array.from(directories).sort(byLength), dir => fs.mkdirAsync(dir))
      .then(() => Promise.map(
                mod.fileEntries,
                file => operation(path.join(nmmVirtualPath, file.fileSource),
                                  path.join(destPath, file.fileDestination))
                            .catch(err => {
                              failedFiles.push(file.fileSource + ' - ' +
                                               err.message);
                            })))
      .then(() => Promise.resolve(failedFiles));
}
