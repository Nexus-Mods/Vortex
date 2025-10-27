import { method as toBluebird } from 'bluebird';
import { generate as shortid } from 'shortid';

import { VortexModInstaller } from "./manager";

import { endDialog, setInstallerDataPath } from '../installer_fomod_shared/actions/installerUI';
import { IGroupList, IInstallerState, IChoices } from '../installer_fomod_shared/types/interface';
import {
  getPluginPath,
  getStopPatterns,
} from '../installer_fomod_shared/util/gameSupport';
import { IExtensionContext } from '../../types/api';
import { getGame } from '../../util/api';

function init(context: IExtensionContext): boolean {

  const install = async (
        files: string[],
        scriptPath: string,
        gameId: string,
        _progressDelegate: any,
        choicesIn?: any,
        unattended?: boolean,
        archivePath?: string
      ) => {

    const canBeUnattended = (choicesIn !== undefined) && (choicesIn.type === 'fomod');
    // If we have fomod choices, automatically bypass the dialog regardless of unattended flag
    const shouldBypassDialog = canBeUnattended && (unattended === true);
    const instanceId = shortid();
    const stopPatterns = getStopPatterns(gameId, getGame(gameId));
    const pluginPath = getPluginPath(gameId);

    context.api.store?.dispatch(setInstallerDataPath(scriptPath, instanceId));

    const fomodChoices = (choicesIn !== undefined) && (choicesIn.type === 'fomod')
      ? (choicesIn.options ?? {})
      : undefined;

    const modInstaller = await VortexModInstaller.getInstance(context.api);
    
    const invokeInstall = async (validate: boolean) => {
      const result = await modInstaller.installAsync(
        files, stopPatterns, pluginPath, scriptPath, fomodChoices, validate);

      const state = context.api.store?.getState();
      const dialogState: IInstallerState = state.session.fomod.installer.dialog.instances[instanceId].state;

      const choices: IChoices = (dialogState?.installSteps === undefined)
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
          options: choices,
        },
      });
      return result;
    };

    try {
      modInstaller.startDialogManager(instanceId, shouldBypassDialog);
      const result = await invokeInstall(true);
      modInstaller.endDialogManager();
      return result;
    } catch (err) {
      /*
      // Don't immediately close dialog on error - other installations might be using it
      // The finally block will handle safe cleanup
      if (err.name === 'System.Xml.XmlException') {
        const res = await context.api.showDialog('error', 'Invalid fomod', {
          text: 'This fomod failed validation. Vortex tends to be stricter validating installers '
              + 'than other tools to ensure mods actually work as expected.\n'
              + 'You can try installing it anyway but we strongly suggest you test if it '
              + 'actually works correctly afterwards - and you should still inform the mod author '
              + 'about this issue.',
          message: err.message,
        }, [
          { label: 'Cancel' },
          { label: 'Ignore' },
        ]);

        if (res.action === 'Ignore') {
          try {
            return await invokeInstall(false);
          } catch (innerErr) {
            const err2 = transformError(innerErr);
            err2['allowReport'] = false;
            return Promise.reject(err2);
          }
        }
      }

      return Promise.reject(transformError(err));
      */

      return Promise.reject(err);
    }
  };

  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 10,
    /*testSupported:*/ toBluebird(async (files: string[], gameId: string) => {
      const modInstaller = await VortexModInstaller.getInstance(context.api);
      const result = await modInstaller.testSupport(files, ['XmlScript']);
      return result;
    }),
    /*install:*/ toBluebird(install)
  );

  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 100,
    /*testSupported:*/ toBluebird(async (files: string[], gameId: string) => {
      const modInstaller = await VortexModInstaller.getInstance(context.api);
      const result = await modInstaller.testSupport(files, ['Basic']);
      return result;
    }),
    /*install:*/ toBluebird(install)
  );

  return true;
}

export default init;
