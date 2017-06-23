import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { log } from 'nmm-api';
import * as path from 'path';
import {IFileEntry as FileEntry, IModEntry as ModEntry} from '../types/nmmEntries';

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

  mod.fileEntries.map((file) => {
    if ((file !== null) && (file !== undefined)) {
      const destPath: string = path.join(currentModPath, mod.vortexId, file.fileDestination);
      fs.mkdirsAsync(path.dirname(destPath))
      .then (() => {
        operation(path.join(nmmVirtualPath, file.fileSource), destPath)
        .catch(err => {
          failedFiles.push(file.fileSource + ' - ' + err.message);
        });
      });
    }
  });

  return Promise.resolve(failedFiles);
}
