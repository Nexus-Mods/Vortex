/**
 * installer for fomods packaged inside another archive.
 * All this does is request the nested file, then delegate the installation
 * to another installer.
 */

import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import {log} from '../../util/log';

import {IProgressDelegate} from '../mod_management/types/IInstall';

import * as path from 'path';

function testSupported(files: string[]): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if ((files.length === 1) && (path.extname(files[0]) === '.fomod')) {
      resolve({ supported: true, requiredFiles: files });
    } else {
      resolve({ supported: false, requiredFiles: [] });
    }
  });
}

function install(files: string[], destinationPath: string,
                 gameId: string, progress: IProgressDelegate,
                 api: IExtensionApi): Promise<any> {
  return new Promise((resolve, reject) => {
    const filePath = path.join(destinationPath, files[0]);
    log('debug', 'install nested', filePath);
    resolve({ instructions: [ { type: 'submodule', path: filePath } ] });
  });
}

export interface IExtensionContextExt extends IExtensionContext {
  registerInstaller: (priority, testSupported, install) => void;
}

function init(context: IExtensionContextExt): boolean {
  context.registerInstaller(
      0, testSupported,
      (files: string[], destinationPath: string, gameId: string,
       progress: IProgressDelegate) =>
          install(files, destinationPath, gameId, progress, context.api));

  return true;
}

export default init;
