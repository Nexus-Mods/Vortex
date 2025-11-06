import { generate as shortid } from 'shortid';

import { VortexModInstaller } from "./utils/VortexModInstaller";

import { IChoices } from '../installer_fomod_shared/types/interface';
import {
  getPluginPath,
  getStopPatterns,
} from '../installer_fomod_shared/utils/gameSupport';
import { getChoicesFromState } from '../installer_fomod_shared/utils/helpers';

import { IInstallationDetails } from '../mod_management/types/InstallFunc';

import { IExtensionApi, IInstallResult, IInstruction, InstructionType } from '../../types/api';
import { getGame, ProcessCanceled } from '../../util/api';

export const install = async (
    api: IExtensionApi,
    files: string[],
    scriptPath: string,
    gameId: string,
    choicesIn?: any,
    unattended?: boolean,
    details?: IInstallationDetails
  ) => {

  const instanceId = shortid();

  const fomodChoices: IChoices = (choicesIn !== undefined) && (choicesIn.type === 'fomod')
    ? (choicesIn.options ?? {})
    : undefined;

  const invokeInstall = async (validate: boolean) => {
    const stopPatterns = getStopPatterns(gameId, getGame(gameId));
    const pluginPath = getPluginPath(gameId);

    const modInstaller = new VortexModInstaller(api, instanceId);
    const result = await modInstaller.installAsync(
      files, stopPatterns, pluginPath, scriptPath, fomodChoices, validate);

    if (result === null) {
      throw new ProcessCanceled("Installation cancelled by user");
    }

    const choices = getChoicesFromState(api, instanceId);

    const transformedResult: IInstallResult = {
      instructions: result.instructions.reduce<IInstruction[]>((map, current) => {
        const currentWithoutType = (({ type, data, ...props }) => props)(current);
        const type = current.type as InstructionType;
        const data = current.data ? Buffer.from(current.data) : undefined;
        map.push({
          type: type,
          data: data,
          ...currentWithoutType
        });
      return map;
      }, []),
    };

    transformedResult.instructions.push({
      type: 'attribute',
      key: 'installerChoices',
      value: {
        type: 'fomod',
        options: choices ?? fomodChoices,
      },
    });
    modInstaller.dispose();
    return transformedResult;
  };

  try {
    const canBeUnattended = fomodChoices != null;
    const shouldBypassDialog = unattended === true && canBeUnattended;
    if (details?.hasXmlConfigXML && !shouldBypassDialog) {
      // This mod will require user interaction, we need to make sure
      //  the the previous phase is deployed.
      await api.ext.awaitNextPhaseDeployment?.();
    }
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
      const res = await api.showDialog?.('error', 'Invalid fomod', {
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
  }
};