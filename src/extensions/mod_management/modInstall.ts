import { log } from '../../util/log';

import { dialog as dialogIn, remote } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// import { ElementSpec, FileSpec, extract7z, list7z } from 'node-7z';
import Zip = require('node-7z');

const dialog = remote !== undefined ? remote.dialog : dialogIn;

export interface IInstallContext {
  startInstallCB: (id: string, archivePath: string, destinationPath: string) => void;
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
 * @param {IInstallContext} context
 */
function extractArchive(archivePath: string,
                        destinationPath: string,
                        context: IInstallContext) {
  const baseName = path.basename(archivePath, path.extname(archivePath));

  let task = new Zip();
  let extract7z = task.extract;

  log('info', 'installing archive', { archivePath, destinationPath });

  context.startInstallCB(baseName, archivePath, destinationPath);

  extract7z(archivePath, destinationPath + '.installing', {})
    .then((args) => {
      fs.rename(destinationPath + '.installing', destinationPath, (err) => {
        if (err !== null) {
          context.reportError(`failed to rename ${destinationPath}`, err.message);
        }
        context.finishInstallCB(baseName, err === null);
      });
    }).catch((err) => {
      context.reportError('failed to extract', err.message);
    });
}

/**
 * start installing an archive from disk
 * 
 * @export
 * @param {string} installPath
 * @param {IInstallContext} context
 */
export function startInstallFile(installPath: string, context: IInstallContext) {
  let destination: string;
  let fileName: string;

  const options: Electron.OpenDialogOptions = {
    properties: ['openFile'],
  };

  dialog.showOpenDialog(null, options, (fileNames: string[]) => {
    if ((fileNames !== undefined) && (fileNames.length > 0)) {
      fileName = fileNames[0];
      const baseName = path.basename(fileName, path.extname(fileName));
      destination = path.join(installPath, baseName);

      extractArchive(fileName, destination, context);
    } else {
      context.reportError('failed to display file dialog');
    }
  });
}
