/**
 * installer for fomods packaged inside another archive.
 * All this does is request the nested file, then delegate the installation
 * to another installer.
 */

import {
  IExtensionApi,
  IExtensionContext,
  ISupportedResult,
  ProgressDelegate,
} from '../../types/IExtensionContext';
import {log} from '../../util/log';

import * as Promise from 'bluebird';
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
                 gameId: string, progress: ProgressDelegate,
                 api: IExtensionApi): Promise<any> {
  return new Promise((resolve, reject) => {
    const fomod = files.find((file) => path.extname(file) === '.fomod');
    const filePath = path.join(destinationPath, fomod);
    log('debug', 'install nested', filePath);
    resolve({ instructions: [ { type: 'submodule', key: fomod, path: filePath } ] });
  });
}

function init(context: IExtensionContext): boolean {
  context.registerInstaller(
      'nested_fomod', 0, testSupported,
      (files: string[], destinationPath: string, gameId: string,
       progress: ProgressDelegate) =>
          install(files, destinationPath, gameId, progress, context.api));

  return true;
}

export default init;
