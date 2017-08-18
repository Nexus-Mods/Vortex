import {IFileEntry as FileEntry, IModEntry as ModEntry} from '../types/nmmEntries';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { log } from 'vortex-api';

/**
 * copy or move a list of mod archives
 * @param {string[]} modArchives
 * @param {string} destSavePath
 * @param {boolean} keepSource
 */
export function transferArchives(modArchives: string[],
                                 currentModsPath: string,
                                 keepSource: boolean): Promise<string[]> {
  const failedArchives: string[] = [];

  const operation = keepSource ? fs.copyAsync : fs.renameAsync;

  return Promise.map(modArchives, archive =>
    operation(archive, path.join(currentModsPath, path.basename(archive)))
    .catch(err => {
      failedArchives.push(archive + ' - ' + err.message);
    }))
    .then(() => Promise.resolve(failedArchives));
}

function byLength(lhs: string, rhs: string): number {
  return lhs.length - rhs.length;
}

/**
 * copy or move a list of mod files
 * @param {ModEntry} mod
 * @param {string} nmmVirtualPath
 * @param {string} currentModPath
 * @param {boolean} keepSource
 */
export function transferUnpackedMod(mod: ModEntry, nmmVirtualPath: string,
                                    installPath: string,
                                    keepSource: boolean): Promise<string[]> {
  const operation = keepSource ? fs.copyAsync : fs.renameAsync;

  const destPath = path.join(installPath, mod.vortexId);

  // determine list of direcotries in the output directory. We create those
  // in a first step in the hope that this is faster than calling mkdirs
  // for each file individually
  const directories = new Set<string>();
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
