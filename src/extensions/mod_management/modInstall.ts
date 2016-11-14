import {log} from '../../util/log';

import * as fs from 'fs-extra-promise';

import * as Promise from 'bluebird';
// import { ElementSpec, FileSpec, extract7z, list7z } from 'node-7z';
import Zip = require('node-7z');

export interface IInstallContext {
  startInstallCB: (id: string, archivePath: string, destinationPath: string) =>
      void;
  finishInstallCB: (id: string, success: boolean) => void;
  progressCB: (percent: number, file: string) => void;
  reportError: (message: string, details?: string) => void;
}

/**
 * extract an archive
 *
 * @export
 * @param {string} archivePath path to the archive file
 * @param {string} destinationPath path to install to
 */
function extractArchive(archivePath: string, destinationPath: string): Promise<void> {
  let task = new Zip();
  let extract7z = task.extractFull;

  log('info', 'installing archive', {archivePath, destinationPath});

  return Promise.resolve(extract7z(archivePath, destinationPath + '.installing', {})
      .then((args: string[]) => {
        return fs.renameAsync(destinationPath + '.installing', destinationPath);
      }));
}

export function installArchive(archivePath: string, destinationPath: string): Promise<void> {
  return extractArchive(archivePath, destinationPath);
}
