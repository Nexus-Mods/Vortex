/**
 * installer for fomods packaged inside another archive.
 * All this does is request the nested file, then delegate the installation
 * to another installer.
 */

import * as fs from 'fs';
import * as path from 'path';
const debugLog = (msg: string) => {
  try {
    const logPath = path.join(process.env.APPDATA || process.env.USERPROFILE || 'C:\\', 'vortex_fomod_debug.log');
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`);
  } catch (err) {
    // Ignore errors
  }
};

debugLog('[FOMOD_NESTED] ===== MODULE LOADING START =====');
import {
  IExtensionApi,
  IExtensionContext,
  ISupportedResult,
  ProgressDelegate,
} from '../../types/IExtensionContext';
debugLog('[FOMOD_NESTED] types imported');
import {log} from '../../util/log';
debugLog('[FOMOD_NESTED] log imported');

import Promise from 'bluebird';
debugLog('[FOMOD_NESTED] ===== MODULE LOADING COMPLETE =====');

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

function install(api: IExtensionApi,
                 files: string[], destinationPath: string,
                 gameId: string, choicesIn: any, unattended: boolean,
                 progress: ProgressDelegate): Promise<any> {
  return new Promise((resolve, reject) => {
    const fomod = files.find((file) => path.extname(file) === '.fomod');
    const filePath = path.join(destinationPath, fomod);
    log('debug', 'install nested', filePath);
    resolve({ instructions: [
      { type: 'submodule', key: fomod, path: filePath, choices: choicesIn, unattended },
    ] });
  });
}

function init(context: IExtensionContext): boolean {
  log('info', '========== [FOMOD_NESTED] Extension initialization STARTED ==========');

  context.registerInstaller(
      'nested_fomod', 0, testSupported,
      (files: string[], destinationPath: string, gameId: string,
       progress: ProgressDelegate, choicesIn?: any, unattended?: boolean) =>
          install(context.api, files, destinationPath, gameId, choicesIn, unattended, progress));

  log('info', '[FOMOD_NESTED] Installer registered (priority 0)');
  log('info', '========== [FOMOD_NESTED] Extension initialization COMPLETE ==========');
  return true;
}

export default init;
