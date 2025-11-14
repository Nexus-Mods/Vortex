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

debugLog('[FOMOD_NATIVE] ===== MODULE LOADING START =====');
import { method as toBluebird } from 'bluebird';
debugLog('[FOMOD_NATIVE] bluebird imported');

import { testSupported } from "./tester";
debugLog('[FOMOD_NATIVE] testSupported imported');
import { install } from "./installer";
debugLog('[FOMOD_NATIVE] install imported');
import { VortexModInstallerFileSystem } from "./utils/VortexModInstallerFileSystem";
debugLog('[FOMOD_NATIVE] VortexModInstallerFileSystem imported');

import { ITestSupportedDetails } from '../mod_management/types/TestSupported';

import { IExtensionContext } from '../../types/IExtensionContext';
import { IInstallationDetails } from '../mod_management/types/InstallFunc';
import { log } from '../../util/log';

const main = (context: IExtensionContext): boolean => {
  debugLog('[FOMOD_NATIVE] main() function CALLED');
  log('info', '========== [FOMOD_NATIVE] Extension initialization STARTED ==========');

  debugLog('[FOMOD_NATIVE] About to register installer (priority 10)');
  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 10,
    /*testSupported:*/ toBluebird(async (
    files: string[],
    _gameId: string,
    _archivePath: string,
    details?: ITestSupportedDetails
  ) => {
    return await testSupported(files, details, false);
  }),
    /*install:*/ toBluebird(async (
    files: string[],
    destinationPath: string,
    gameId: string,
    _progressDelegate: unknown,
    choices?: unknown,
    unattended?: boolean,
    _archivePath?: string,
    details?: IInstallationDetails
  ) => {
    return await install(context.api, files, destinationPath, gameId, choices, unattended, details);
  }
  )
  );
  debugLog('[FOMOD_NATIVE] Installer registered (priority 10)');

  debugLog('[FOMOD_NATIVE] About to register installer (priority 100)');
  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 100,
    /*testSupported:*/ toBluebird(async (
    files: string[],
    _gameId: string,
    _archivePath: string,
    details?: ITestSupportedDetails
  ) => {
    return await testSupported(files, details, true);
  }),
    /*install:*/ toBluebird(async (
    files: string[],
    destinationPath: string,
    gameId: string,
    _progressDelegate: unknown,
    choices?: unknown,
    unattended?: boolean,
    _archivePath?: string,
    details?: IInstallationDetails
  ) => {
    return await install(context.api, files, destinationPath, gameId, choices, unattended, details);
  }
  )
  );

  context.once(() => {
    debugLog('[FOMOD_NATIVE] About to create VortexModInstallerFileSystem');
    new Promise<void>((resolve, reject) => {
      try {
        const fileSystem = new VortexModInstallerFileSystem();
        debugLog('[FOMOD_NATIVE] VortexModInstallerFileSystem created');
        debugLog('[FOMOD_NATIVE] About to call useLibraryFunctions()');
        fileSystem.useLibraryFunctions();
        debugLog('[FOMOD_NATIVE] useLibraryFunctions() completed successfully');
        resolve();
      } catch (err) {
        debugLog(`[FOMOD_NATIVE] ERROR in useLibraryFunctions(): ${err.message}`);
        reject(err);
      }
  
      log('info', '[FOMOD_NATIVE] VortexModInstallerFileSystem initialized');
    });
    
  });
  debugLog('[FOMOD_NATIVE] Installer registered (priority 100)');

  log('info', '[FOMOD_NATIVE] Both installers registered (priority 10 and 100)');
  debugLog('[FOMOD_NATIVE] About to return true from main()');
  log('info', '========== [FOMOD_NATIVE] Extension initialization COMPLETE ==========');
  return true;
}

export default main;
