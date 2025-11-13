import { method as toBluebird } from 'bluebird';

import { testSupported } from "./tester";
import { install } from "./installer";
import { VortexModInstallerFileSystem } from "./utils/VortexModInstallerFileSystem";

import { ITestSupportedDetails } from '../mod_management/types/TestSupported';

import { IExtensionContext } from '../../types/api';
import { IInstallationDetails } from '../mod_management/types/InstallFunc';

const main = (context: IExtensionContext): boolean => {
  const fileSystem = new VortexModInstallerFileSystem();
  fileSystem.useLibraryFunctions();

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

  return true;
}

export default main;
