/**
 * installer for fomods packaged inside another archive.
 * All this does is request the nested file, then delegate the installation
 * to another installer.
 */

import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import {log} from '../../util/log';

import {IProgressDelegate} from '../mod_management/types/IInstall';
import {ISupportedResult} from '../mod_management/types/ITestSupported';

import * as path from 'path';

function testSupported(files: string[]): Promise<ISupportedResult> {
  return new Promise((resolve, reject) => {
    const fomod = files.find((file) => path.extname(file) === '.fomod');
    if (fomod !== undefined) {
      resolve({ supported: true, requiredFiles: [ fomod ] });
    } else {
      resolve({ supported: false, requiredFiles: [] });
    }
  });
}

function install(files: string[], destinationPath: string,
                 gameId: string, progress: IProgressDelegate,
                 api: IExtensionApi): Promise<any> {
  return new Promise((resolve, reject) => {
    const fomod = files.find((file) => path.extname(file) === '.fomod');
    const filePath = path.join(destinationPath, fomod);
    log('debug', 'install nested', filePath);
    resolve({ instructions: [ { type: 'submodule', key: fomod, path: filePath } ] });
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
