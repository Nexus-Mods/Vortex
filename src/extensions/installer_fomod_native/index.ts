import { method as toBluebird } from 'bluebird';

import { install } from "./installer";
import { VortexModInstallerFileSystem } from "./utils/VortexModInstallerFileSystem";

import { ITestSupportedDetails } from '../mod_management/types/TestSupported';

import { IExtensionContext } from '../../types/api';
import { IInstallationDetails } from '../mod_management/types/InstallFunc';
import { VortexModInstaller } from './utils/VortexModInstaller';

const main = (context: IExtensionContext): boolean => {
  const fileSystem = new VortexModInstallerFileSystem();
  fileSystem.useLibraryFunctions();

  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 10,
    /*testSupported:*/ toBluebird((
      files: string[],
      _gameId: string,
      _archivePath: string,
      details?: ITestSupportedDetails
    ) => {
      if (details && details.hasXmlConfigXML === false) {
        return { 
          supported: false,
          requiredFiles: []
        };
      }
      const result = VortexModInstaller.testSupport(files, ['XmlScript']);
      return Promise.resolve(result);
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
    /*testSupported:*/ toBluebird((
      files: string[],
      _gameId: string,
      _archivePath: string,
      _details?: ITestSupportedDetails
    ) => {
      const result = VortexModInstaller.testSupport(files, ['Basic']);
      return Promise.resolve(result);
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
