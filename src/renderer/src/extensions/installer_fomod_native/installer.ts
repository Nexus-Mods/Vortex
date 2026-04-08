import { generate as shortid } from "shortid";

import { VortexModInstaller } from "./utils/VortexModInstaller";

import type { IChoices } from "../installer_fomod_shared/types/interface";
import {
  getPluginPath,
  getStopPatterns,
  uniPatterns,
} from "../installer_fomod_shared/utils/gameSupport";
import { getChoicesFromState } from "../installer_fomod_shared/utils/helpers";

import type { IInstallationDetails } from "../mod_management/types/InstallFunc";

import type {
  IExtensionApi,
  IInstallResult,
  IInstruction,
  InstructionType,
} from "../../types/api";
import { getGame } from "../gamemode_management/util/getGame";
import { UserCanceled } from "../../util/CustomErrors";

export const install = async (
  api: IExtensionApi,
  files: string[],
  scriptPath: string,
  gameId: string,
  choicesIn?: any,
  unattended?: boolean,
  details?: IInstallationDetails,
) => {
  const instanceId = shortid();

  const fomodChoices: IChoices =
    choicesIn !== undefined && choicesIn.type === "fomod"
      ? (choicesIn.options ?? {})
      : undefined;

  const invokeInstall = async (validate: boolean) => {
    // When override instructions file is present, use only the universal stop patterns and null pluginPath
    // to prevent any automatic path manipulation (both FindPathPrefix and pluginPath stripping)
    const stopPatterns = details.hasInstructionsOverrideFile
      ? uniPatterns
      : getStopPatterns(gameId, getGame(gameId));
    const pluginPath = details.hasInstructionsOverrideFile
      ? null
      : getPluginPath(gameId);

    // Skip Redux dialog-state dispatches when we have a preset and are running
    // unattended (collection install). The C# fomod still calls uiUpdateState
    // per step, but those TSFN callbacks would otherwise block the JS main
    // thread — converting/dispatching large installSteps arrays — for no
    // visible benefit since the dialog is never shown.
    const isUnattended = unattended === true && fomodChoices != null;

    // When attended (manual reinstall) with saved choices, don't pass them to
    // the C# engine — it would auto-advance through matching steps without
    // showing the dialog. Instead, pass them as "attended presets" so the
    // DialogManager can pre-select options in the UI while still showing the
    // dialog for user modification.
    const attendedPresets =
      !isUnattended && fomodChoices != null ? fomodChoices : undefined;
    const enginePreset = isUnattended ? fomodChoices : undefined;

    const modInstaller = await VortexModInstaller.create(
      api,
      instanceId,
      gameId,
      isUnattended,
      attendedPresets,
    );

    const result = await modInstaller.installAsync(
      files,
      stopPatterns,
      pluginPath,
      scriptPath,
      enginePreset,
      validate,
    );

    if (!result) {
      throw new UserCanceled();
    }

    const choices = getChoicesFromState(api, instanceId);

    const transformedResult: IInstallResult = {
      instructions: result.instructions.reduce<IInstruction[]>(
        (map, current) => {
          const currentWithoutType = (({ type, data, ...props }) => props)(
            current,
          );
          const type = current.type as InstructionType;
          const data = current.data ? Buffer.from(current.data) : undefined;
          map.push({
            type: type,
            data: data,
            ...currentWithoutType,
          });
          return map;
        },
        [],
      ),
    };

    transformedResult.instructions.push({
      type: "attribute",
      key: "installerChoices",
      value: {
        type: "fomod",
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
    const isValidationError =
      err instanceof Error &&
      (err.message?.includes("Invalid XML") ||
        err.message?.includes("XmlException") ||
        err.message?.includes("validation") ||
        err.stack?.includes("Validate"));

    if (isValidationError) {
      const res = await api.showDialog?.(
        "error",
        "Invalid fomod",
        {
          text:
            "This fomod failed validation. Vortex tends to be stricter validating installers " +
            "than other tools to ensure mods actually work as expected.\n" +
            "You can try installing it anyway but we strongly suggest you test if it " +
            "actually works correctly afterwards - and you should still inform the mod author " +
            "about this issue.",
          message: err.message || "Unknown validation error",
        },
        [{ label: "Cancel" }, { label: "Ignore" }],
      );

      if (res.action === "Ignore") {
        try {
          // Retry installation with validation disabled
          return await invokeInstall(false);
        } catch (innerErr) {
          // If it still fails without validation, don't allow error reporting
          if (innerErr instanceof Error) {
            innerErr["allowReport"] = false;
          }
          return Promise.reject(innerErr);
        }
      }
    }

    // For all other errors, reject with the original error
    return Promise.reject(err);
  }
};
