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

/**
 * copy or move a list of mod files
 * @param {ModEntry} mod
 * @param {string} nmmVirtualPath
 * @param {string} currentModPath
 * @param {boolean} keepSource
 */
export function transferUnpackedMod(mod: ModEntry,
                                    nmmVirtualPath: string,
                                    currentModPath: string,
                                    keepSource: boolean): Promise<string[]> {
  const failedFiles: string[] = [];

  const operation = keepSource ? fs.copyAsync : fs.renameAsync;

  return Promise.map(mod.fileEntries, file =>
      fs.mkdirsAsync(path.dirname(path.join(currentModPath, mod.vortexId, file.fileDestination)))
      .then (() =>
        operation(path.join(nmmVirtualPath, file.fileSource),
          path.join(currentModPath, mod.vortexId, file.fileDestination))
        .catch(err => {
          failedFiles.push(file.fileSource + ' - ' + err.message);
        })))
  .then(() => Promise.resolve(failedFiles));
}
