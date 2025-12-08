import { method as toBluebird } from 'bluebird';
import { SupportsAppContainer } from 'winapi-bindings';
import { testSupported } from './tester';
import { install } from './installer';
import { ITestSupportedDetails } from '../mod_management/types/TestSupported';
import { IInstallationDetails } from '../mod_management/types/InstallFunc';
import { IExtensionContext } from '../../types/IExtensionContext';
import { settingsReducer } from './reducers/sandbox';
import Sandbox from './views/Sandbox';

/**
 * Extension initialization
 */
const main = (context: IExtensionContext): boolean => {
  context.registerReducer(['settings', 'mods'], settingsReducer);

  const osSupportsAppContainer = SupportsAppContainer?.() ?? false;
  context.registerSettings('Workarounds', Sandbox, () => ({
    osSupportsAppContainer,
  }));

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
    })
  );

  return true;
}

export default main;
