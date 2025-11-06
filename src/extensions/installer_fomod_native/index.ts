import { method as toBluebird } from 'bluebird';

import { install } from "./installer";
import { VortexModTester } from "./utils/VortexModTester";

import { ITestSupportedDetails } from '../mod_management/types/TestSupported';

import { IExtensionContext } from '../../types/api';
import { IInstallationDetails } from '../mod_management/types/InstallFunc';

const main = (context: IExtensionContext): boolean => {
  const modTester = new VortexModTester();

  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 10,
    /*testSupported:*/ toBluebird(async (
      files: string[],
      _gameId: string,
      _archivePath: string,
      details?: ITestSupportedDetails
    ) => {
      if (details && (details.hasXmlConfigXML === false || details.hasCSScripts === false)) {
        return { 
          supported: false,
          requiredFiles: []
        };
      }
      const result = await modTester.testSupport(files, ['XmlScript']);
      return result;
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
      _details?: ITestSupportedDetails
    ) => {
      const result = await modTester.testSupport(files, ['Basic']);
      return result;
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
