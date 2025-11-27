import { method as toBluebird } from 'bluebird';
import { testSupported } from "./tester";
import { install } from "./installer";
import { VortexModInstallerLogger } from "./utils/VortexModInstallerLogger";
import { VortexModInstallerFileSystem } from "./utils/VortexModInstallerFileSystem";
import { ITestSupportedDetails } from '../mod_management/types/TestSupported';
import { IExtensionContext } from '../../types/IExtensionContext';
import { IInstallationDetails } from '../mod_management/types/InstallFunc';
import { log } from '../../util/log';

let logger: VortexModInstallerLogger | null = null;
let fileSystem: VortexModInstallerFileSystem | null = null;

const main = (context: IExtensionContext): boolean => {
  log('info', '========== [FOMOD_NATIVE] Extension initialization STARTED ==========');

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
    })
  );

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
    })
  );

  context.once(() => {
    context.api.onAsync('will-install-mod', async (_gameId: string, _archiveId: string, _modId: string) => {
      if (logger != null) {
        logger = new VortexModInstallerLogger();
        logger.useVortexFunctions();
      }
      if (fileSystem != null) {
        fileSystem = new VortexModInstallerFileSystem();
        fileSystem.useVortexFunctions();
      }
    });
  });

  return true;
}

export default main;
