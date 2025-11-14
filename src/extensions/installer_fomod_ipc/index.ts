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

debugLog('[FOMOD_IPC] ===== MODULE LOADING START =====');
import { method as toBluebird } from 'bluebird';
debugLog('[FOMOD_IPC] fomod-installer-ipc imported');
import { testSupported } from './tester';
debugLog('[FOMOD_IPC] testSupported imported');
import { install } from './installer';
debugLog('[FOMOD_IPC] install imported');
import { ITestSupportedDetails } from '../mod_management/types/TestSupported';
import { IInstallationDetails } from '../mod_management/types/InstallFunc';
import { IExtensionContext } from '../../types/IExtensionContext';
debugLog('[FOMOD_IPC] types imported');
import { log } from '../../util/log';
debugLog('[FOMOD_IPC] ===== MODULE LOADING COMPLETE =====');

/**
 * Extension initialization
 */
const main = (context: IExtensionContext): boolean => {
  log('info', '========== [FOMOD_IPC] Extension initialization STARTED ==========');

  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 20,
    /*testSupported:*/ toBluebird(async (
      files: string[],
      gameId: string,
      _archivePath?: string,
      details?: ITestSupportedDetails
    ) => {
      return await testSupported(context.api, files, gameId, details);
    }),
    /*install:*/ toBluebird(async (
        files: string[],
        destinationPath: string,
        gameId: string,
        _progressDelegate: unknown,
        choices?: unknown,
        unattended?: boolean,
        archivePath?: string,
        details?: IInstallationDetails
      ) => {
        return await install(context.api, files, destinationPath, gameId, choices, unattended, archivePath, details);
      }
    )
  );

  log('info', '[FOMOD_IPC] Installer registered (priority 20)');
  log('info', '========== [FOMOD_IPC] Extension initialization COMPLETE ==========');
  return true;
}

export default main;
