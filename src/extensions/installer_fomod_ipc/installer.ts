import path from 'path';
import { SecurityLevel } from 'fomod-installer-ipc';
import { CSharpDelegates } from './delegates/CSharpDelegates';
import { VortexIPCConnection } from './utils/VortexIPCConnection';
import { createConnectionStrategies } from './utils/connectionStrategy';
import { IInstallationDetails } from '../mod_management/types/InstallFunc';
import { SharedDelegates } from '../installer_fomod_shared/delegates/SharedDelegates';
import { IChoices } from '../installer_fomod_shared/types/interface';
import { getPluginPath, getStopPatterns, uniPatterns } from '../installer_fomod_shared/utils/gameSupport';
import { getGame } from '../gamemode_management/util/getGame';
import { log } from '../../util/log';
import { IExtensionApi, IInstallResult } from '../../types/api';
import { ProcessCanceled, InstallationSkipped } from '../../util/CustomErrors';
import { } from '../installer_dotnet/';

/**
 * Install a FOMOD mod
 */
export const install = async (
  api: IExtensionApi,
  files: string[],
  destinationPath: string,
  gameId: string,
  choices?: any,
  unattended?: boolean,
  archivePath?: string,
  details?: IInstallationDetails,
): Promise<IInstallResult> => {
  let connection: VortexIPCConnection | null = null;

  try {
    const canBeUnattended = choices !== undefined && choices.type === "fomod";
    // If we have fomod choices, automatically bypass the dialog regardless of unattended flag
    const shouldBypassDialog = canBeUnattended && unattended === true;

    const hasScript = files.some(
      (file) => path.basename(file).toLowerCase() === "script.cs",
    );
    if (hasScript && !shouldBypassDialog) {
      // This mod will require user interaction, we need to make sure
      // the the previous phase is deployed.
      await api.ext.awaitNextPhaseDeployment?.();
    }

    await api.ext?.awaitDotnetAssert?.();

    const state = api.getState();
    const isSandboxDisabled = !state.settings.mods.installerSandbox;
    const securityLevel =
      details?.isTrusted === true || isSandboxDisabled
        ? SecurityLevel.Regular
        : SecurityLevel.Sandbox;
    const strategies = createConnectionStrategies({
      securityLevel: securityLevel,
      allowFallback: true,
    });
    const modName =
      details?.modReference?.id ||
      path.basename(archivePath, path.extname(archivePath));
    connection = new VortexIPCConnection(api, strategies, 30000, modName);
    await connection.initialize();

    // Register core delegates
    const sharedDelegates = await SharedDelegates.create(api, gameId);
    connection.registerCallback("getAppVersion", () =>
      sharedDelegates.getAppVersion(),
    );
    connection.registerCallback("getCurrentGameVersion", () =>
      sharedDelegates.getCurrentGameVersion(),
    );
    connection.registerCallback("getExtenderVersion", (extender: string) =>
      sharedDelegates.getExtenderVersion(extender),
    );
    connection.registerCallback("getAll", (activeOnly: boolean) =>
      sharedDelegates.getAllPlugins(activeOnly),
    );

    const csharpDelegates = new CSharpDelegates(api);
    connection.registerCallback("isExtenderPresent", () =>
      csharpDelegates.isExtenderPresent(),
    );
    connection.registerCallback("checkIfFileExists", (fileName: string) =>
      csharpDelegates.checkIfFileExists(fileName),
    );
    connection.registerCallback("getExistingDataFile", (dataFile: string) =>
      csharpDelegates.getExistingDataFile(dataFile),
    );
    connection.registerCallback(
      "getExistingDataFileList",
      (folderPath: string, searchFilter: string, isRecursive: boolean) =>
        csharpDelegates.getExistingDataFileList(
          folderPath,
          searchFilter,
          isRecursive,
        ),
    );
    connection.registerCallback(
      "getIniString",
      (iniFileName: string, section: string, key: string) =>
        csharpDelegates.getIniString(iniFileName, section, key),
    );
    connection.registerCallback(
      "getIniInt",
      (iniFileName: string, section: string, key: string) =>
        csharpDelegates.getIniInt(iniFileName, section, key),
    );
    connection.registerCallback(
      "reportError",
      ({
        title,
        message,
        details,
      }: {
        title: string;
        message: string;
        details: string;
      }) => csharpDelegates.reportError(title, message, details),
    );

    // When override instructions file is present, use only the universal stop patterns and null pluginPath
    // to prevent any automatic path manipulation (both FindPathPrefix and pluginPath stripping)
    const stopPatterns = details?.hasInstructionsOverrideFile
      ? uniPatterns
      : getStopPatterns(gameId, getGame(gameId));
    const pluginPath = details?.hasInstructionsOverrideFile
      ? null
      : getPluginPath(gameId);

    const fomodChoices: IChoices =
      choices !== undefined && choices.type === "fomod"
        ? (choices.options ?? {})
        : undefined;

    const validate = true;

    const result = await connection.install(
      files,
      stopPatterns,
      pluginPath,
      destinationPath,
      fomodChoices,
      validate,
    );

    if (!result) {
      throw new ProcessCanceled("Installation cancelled by user");
    }

    if (result.instructions.length === 1 && result.instructions[0].type as string === 'enableallplugins') {
      throw new InstallationSkipped(); // No files to copy, skip the mod
    }

    log('info', 'FOMOD installation completed', { gameId });

    if (
      result.instructions !== undefined &&
      Array.isArray(result.instructions)
    ) {
      for (const instruction of result.instructions) {
        if (instruction.type === "generatefile") {
          var json = instruction.data as any;
          if (
            json.type &&
            json.type === "Buffer" &&
            typeof json.data === "string"
          ) {
            instruction.data = Buffer.from(json.data, "base64");
          }
        }
      }
    }

    result.instructions.push({
      type: "attribute",
      key: "installerChoices",
      value: {
        type: "fomod",
        options: choices ?? fomodChoices,
      },
    });

    return result;
  } catch (err: any) {
    // Provide context-aware error messages based on error type
    const errorName = err.name || "Error";
    const isTimeout = errorName === "IPCTimeoutError";
    const isConnectionError =
      errorName === "ProcessExitError" || errorName === "ProcessError";

    log("error", "FOMOD installation failed", {
      errorName,
      error: err.message,
      gameId,
      isTimeout,
      isConnectionError,
    });

    // Add user-friendly error context
    if (isTimeout) {
      const timeoutError = new Error(
        `FOMOD installation timed out. The installer process may be unresponsive or stuck. ` +
          `Original error: ${err.message}`,
      );
      timeoutError.name = "FOMODTimeoutError";
      throw timeoutError;
    } else if (isConnectionError) {
      const connectionError = new Error(
        `FOMOD installer process failed unexpectedly. This may be due to missing dependencies or system issues. ` +
          `Original error: ${err.message}`,
      );
      connectionError.name = "FOMODConnectionError";
      throw connectionError;
    }

    // Re-throw original error for other cases
    throw err;
  } finally {
    if (connection) {
      await connection.dispose();
    }
  }
};
