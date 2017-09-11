import {IModEntry} from '../types/moEntries';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { log, util } from 'vortex-api';

/**
 * copy or move a list of mod archives
 * @param {string[]} modArchives
 * @param {string} destSavePath
 * @param {boolean} keepSource
 */
export function transferArchive(archivePath: string,
                                downloadPath: string,
                                keepSource: boolean): Promise<void> {
  const operation = keepSource ? fs.copyAsync : fs.renameAsync;

  return operation(archivePath, path.join(downloadPath, path.basename(archivePath)))
    .catch(err => {
      if (err.code !== 'ENOENT') {
        return Promise.reject(err);
      }
    });
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
export function transferUnpackedMod(mod: IModEntry, moModPath: string,
                                    installPath: string,
                                    keepSource: boolean): Promise<void> {
  const operation = keepSource ? util.copyRecursive : fs.renameAsync;

  const destPath = path.join(installPath, mod.vortexId);

  // determine list of directories in the output directory. We create those
  // in a first step in the hope that this is faster than calling mkdirs
  // for each file individually
  const directories = new Set<string>();

  return operation(moModPath, destPath)
    .then(() => fs.removeAsync(path.join(destPath, 'meta.ini')));
}
