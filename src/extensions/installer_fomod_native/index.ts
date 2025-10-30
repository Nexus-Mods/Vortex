import { method as toBluebird } from 'bluebird';
import { generate as shortid } from 'shortid';

import { VortexModInstaller, VortexModTester } from "./manager";

import { clearDialog, setInstallerDataPath } from '../installer_fomod_shared/actions/installerUI';
import { IGroupList, IInstallerState, IChoices } from '../installer_fomod_shared/types/interface';
import {
  getPluginPath,
  getStopPatterns,
} from '../installer_fomod_shared/utils/gameSupport';
import { IExtensionContext } from '../../types/api';
import { getGame } from '../../util/api';
import { ITestSupportedDetails } from '../mod_management/types/TestSupported';
import { IInstallationDetails } from '../mod_management/types/InstallFunc';

function init(context: IExtensionContext): boolean {
  const modTester = new VortexModTester();

  const install = async (
        files: string[],
        scriptPath: string,
        gameId: string,
        _progressDelegate: any,
        choicesIn?: any,
        unattended?: boolean,
        archivePath?: string
      ) => {

    // If we have fomod choices, automatically bypass the dialog regardless of unattended flag
    const instanceId = shortid();
    const stopPatterns = getStopPatterns(gameId, getGame(gameId));
    const pluginPath = getPluginPath(gameId);

    context.api.store?.dispatch(setInstallerDataPath(scriptPath, instanceId));

    const fomodChoices = (choicesIn !== undefined) && (choicesIn.type === 'fomod')
      ? (choicesIn.options ?? {})
      : undefined;
    
    const invokeInstall = async (validate: boolean) => {
      const modInstaller = new VortexModInstaller(context.api, instanceId);
      const result = await modInstaller.installAsync(
        files, stopPatterns, pluginPath, scriptPath, fomodChoices, validate);

      const state = context.api.store.getState();
      const dialogState: IInstallerState = state.session.fomod.installer.dialog.instances[instanceId].state;

      const choices = (dialogState?.installSteps === undefined)
        ? undefined
        : dialogState.installSteps.map(step => {
          const ofg: IGroupList = step.optionalFileGroups || { group: [], order: 'Explicit' };
          return {
            name: step.name,
            groups: (ofg.group || []).map(group => ({
              name: group.name,
              choices: group.options
                .filter(opt => opt.selected)
                .map(opt => ({ name: opt.name, idx: opt.id })),
            })),
          };
        });

      result.instructions.push({
        type: 'attribute',
        key: 'installerChoices',
        value: {
          type: 'fomod',
          options: choices ?? fomodChoices,
        },
      });
      return result;
    };

    try {
      const result = await invokeInstall(true);
      return result;
    } catch (err) {
      // Native implementation throws JavaScript errors, not C# error objects
      // Check if this is an XML validation error by examining the error message/stack
      const isValidationError = err instanceof Error && (
        err.message?.includes('Invalid XML') ||
        err.message?.includes('XmlException') ||
        err.message?.includes('validation') ||
        err.stack?.includes('Validate')
      );

      if (isValidationError) {
        const res = await context.api.showDialog('error', 'Invalid fomod', {
          text: 'This fomod failed validation. Vortex tends to be stricter validating installers '
              + 'than other tools to ensure mods actually work as expected.\n'
              + 'You can try installing it anyway but we strongly suggest you test if it '
              + 'actually works correctly afterwards - and you should still inform the mod author '
              + 'about this issue.',
          message: err.message || 'Unknown validation error',
        }, [
          { label: 'Cancel' },
          { label: 'Ignore' },
        ]);

        if (res.action === 'Ignore') {
          try {
            // Retry installation with validation disabled
            return await invokeInstall(false);
          } catch (innerErr) {
            // If it still fails without validation, don't allow error reporting
            if (innerErr instanceof Error) {
              innerErr['allowReport'] = false;
            }
            return Promise.reject(innerErr);
          }
        }
      }

      // For all other errors, reject with the original error
      return Promise.reject(err);
    } finally {
      context.api.store.dispatch(clearDialog(instanceId));
    }
  };

  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 10,
    /*testSupported:*/ toBluebird(async (files: string[], _gameId: string, _archivePath: string, details?: ITestSupportedDetails) => {
      if (details !== undefined && (details.hasXmlConfigXML === false || details.hasCSScripts === false)) {
        return { 
          supported: false,
          requiredFiles: []
        };
      }
      const result = await modTester.testSupport(files, ['XmlScript']);
      return result;
    }),
    /*install:*/ toBluebird(install)
  );

  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 100,
    /*testSupported:*/ toBluebird(async (files: string[], _gameId: string, _archivePath: string, details?: ITestSupportedDetails) => {
      const result = await modTester.testSupport(files, ['Basic']);
      return result;
    }),
    /*install:*/ toBluebird(install)
  );

  return true;
}

export default init;
