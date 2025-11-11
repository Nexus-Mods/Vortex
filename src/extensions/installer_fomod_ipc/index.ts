import { method as toBluebird } from 'bluebird';
import path from 'path';
import { IPCConnection, ConnectionStrategy } from './IPCConnection';
import { SecurityLevel, RegularProcessLauncher, SandboxProcessLauncher } from './launchers';
import { NamedPipeTransport, TCPTransport } from './transport';
import { CSharpDelegates } from './delegates/CSharpDelegates';
import { ITestSupportedDetails } from '../mod_management/types/TestSupported';
import { IInstallationDetails } from '../mod_management/types/InstallFunc';
import { SharedDelegates } from '../installer_fomod_shared/delegates/SharedDelegates';
import { IChoices } from '../installer_fomod_shared/types/interface';
import { getPluginPath, getStopPatterns, uniPatterns } from '../installer_fomod_shared/utils/gameSupport';
import { getGame } from '../../util/api';
import { log } from '../../util/log';
import { IExtensionContext, IInstallResult, ISupportedResult } from '../../types/IExtensionContext';

/**
 * Helper function to create connection strategies from launcher options
 */
const createConnectionStrategies = (options?: {
  securityLevel?: SecurityLevel;
  allowFallback?: boolean;
  containerName?: string;
}): ConnectionStrategy[] => {
  const strategies: ConnectionStrategy[] = [];

  const securityLevel = options?.securityLevel || SecurityLevel.Sandbox;
  const allowFallback = options?.allowFallback !== false;
  const containerName = options?.containerName || 'fomod_installer';

  if (securityLevel === SecurityLevel.Sandbox) {
    const namedPipeTransport = new NamedPipeTransport();
    const sandboxLauncher = new SandboxProcessLauncher({
      containerName,
      transport: namedPipeTransport
    });

    // Named Pipe with sandbox launcher (ACL configuration handled automatically)
    strategies.push({
      transport: namedPipeTransport,
      launcher: sandboxLauncher
    });
  }

  if (securityLevel === SecurityLevel.Sandbox && allowFallback || securityLevel === SecurityLevel.Regular) {
    // Named Pipe with regular launcher
    strategies.push({
      transport: new NamedPipeTransport(),
      launcher: new RegularProcessLauncher()
    });
  } 

  if (securityLevel === SecurityLevel.Sandbox && allowFallback || securityLevel === SecurityLevel.Regular && allowFallback) {
    // TCP with regular launcher
    strategies.push({
      transport: new TCPTransport(),
      launcher: new RegularProcessLauncher()
    });
  }

  return strategies;
}

/**
 * Test if files are supported by the FOMOD installer
 */
const testSupported = async (
  files: string[],
  gameId: string,
  details?: ITestSupportedDetails
): Promise<ISupportedResult> => {
  if (!['oblivion', 'fallout3', 'falloutnv'].includes(gameId)) {
    return { 
      supported: false,
      requiredFiles: []
    };
  }

  if (details && details.hasCSScripts === false) {
    return { 
      supported: false,
      requiredFiles: []
    };
  }

  let connection: IPCConnection | null = null;

  try {
    const strategies = createConnectionStrategies();
    connection = new IPCConnection(strategies, 10000);
    await connection.initialize();

    const result = await connection.testSupported(files, ['CSharpScript']);

    log('debug', 'FOMOD testSupported result', {
      supported: result.supported,
      requiredFiles: result.requiredFiles,
      gameId,
    });

    return result;
  } catch (err) {
    const errorName = err.name || 'Error';
    log('error', 'FOMOD testSupported failed', {
      errorName,
      error: err.message,
      gameId,
    });

    return {
      supported: false,
      requiredFiles: [],
    };
  } finally {
    if (connection) {
      await connection.dispose();
    }
  }
}

/**
 * Install a FOMOD mod
 */
const install = async (
  files: string[],
  destinationPath: string,
  gameId: string,
  choices?: any,
  unattended?: boolean,
  details?: IInstallationDetails,
  api?: any
): Promise<IInstallResult> => {
  let connection: IPCConnection | null = null;

  try {
    const canBeUnattended = (choices !== undefined) && (choices.type === 'fomod');
    // If we have fomod choices, automatically bypass the dialog regardless of unattended flag
    const shouldBypassDialog = canBeUnattended && (unattended === true);

    const hasModuleConfig = files.some(file => path.basename(file).toLowerCase() === 'moduleconfig.xml');
    if (hasModuleConfig && !shouldBypassDialog) {
      // This mod will require user interaction, we need to make sure
      // the the previous phase is deployed.
      await api.ext.awaitNextPhaseDeployment?.();
    }

    const strategies = createConnectionStrategies({ securityLevel: details?.isTrusted === true ? SecurityLevel.Regular : SecurityLevel.Sandbox, allowFallback: true });
    connection = new IPCConnection(strategies, 10000, api);
    await connection.initialize();

    // Register core delegates
    const sharedDelegates = await SharedDelegates.create(api);
    connection.registerCallback('getAppVersion', () => sharedDelegates.getAppVersion());
    connection.registerCallback('getCurrentGameVersion', () => sharedDelegates.getCurrentGameVersion());
    connection.registerCallback('getExtenderVersion', (extender: string) => sharedDelegates.getExtenderVersion(extender));
    connection.registerCallback('getAllPlugins', (activeOnly: boolean) => sharedDelegates.getAllPlugins(activeOnly));

    const csharpDelegates = new CSharpDelegates(api);
    connection.registerCallback('isExtenderPresent', () => csharpDelegates.isExtenderPresent());
    connection.registerCallback('checkIfFileExists', (fileName: string) => csharpDelegates.checkIfFileExists(fileName));
    connection.registerCallback('getExistingDataFile', (dataFile: string) => csharpDelegates.getExistingDataFile(dataFile));
    connection.registerCallback('getExistingDataFileList', (folderPath: string, searchFilter: string, isRecursive: boolean) => csharpDelegates.getExistingDataFileList(folderPath, searchFilter, isRecursive));
    connection.registerCallback('getIniString', (iniFileName: string, section: string, key: string) => csharpDelegates.getIniString(iniFileName, section, key));
    connection.registerCallback('getIniInt', (iniFileName: string, section: string, key: string) => csharpDelegates.getIniInt(iniFileName, section, key));
    connection.registerCallback('reportError', (title: string, message: string, details: string) => csharpDelegates.reportError(title, message, details));

    // When override instructions file is present, use only the universal stop patterns and null pluginPath
    // to prevent any automatic path manipulation (both FindPathPrefix and pluginPath stripping)
    const stopPatterns = details.hasInstructionsOverrideFile ? uniPatterns : getStopPatterns(gameId, getGame(gameId));
    const pluginPath = details.hasInstructionsOverrideFile ? null : getPluginPath(gameId);

    const fomodChoices: IChoices = (choices !== undefined) && (choices.type === 'fomod')
      ? (choices.options ?? {})
      : undefined;

    const validate = true;

    const result = await connection.install(
      files,
      stopPatterns,
      pluginPath,
      destinationPath,
      fomodChoices,
      validate
    );

    log('info', 'FOMOD installation completed', { gameId });

    result.instructions.push({
      type: 'attribute',
      key: 'installerChoices',
      value: {
        type: 'fomod',
        options: choices ?? fomodChoices,
      },
    });

    return result;
  } catch (err) {
    // Provide context-aware error messages based on error type
    const errorName = err.name || 'Error';
    const isTimeout = errorName === 'IPCTimeoutError';
    const isConnectionError = errorName === 'ProcessExitError' || errorName === 'ProcessError';

    log('error', 'FOMOD installation failed', {
      errorName,
      error: err.message,
      gameId,
      isTimeout,
      isConnectionError
    });

    // Add user-friendly error context
    if (isTimeout) {
      const timeoutError = new Error(
        `FOMOD installation timed out. The installer process may be unresponsive or stuck. ` +
        `Original error: ${err.message}`
      );
      timeoutError.name = 'FOMODTimeoutError';
      throw timeoutError;
    } else if (isConnectionError) {
      const connectionError = new Error(
        `FOMOD installer process failed unexpectedly. This may be due to missing dependencies or system issues. ` +
        `Original error: ${err.message}`
      );
      connectionError.name = 'FOMODConnectionError';
      throw connectionError;
    }

    // Re-throw original error for other cases
    throw err;
  } finally {
    if (connection) {
      await connection.dispose();
    }
  }
}

/**
 * Extension initialization
 */
const main = (context: IExtensionContext): boolean => {

  context.registerInstaller(
    /*id:*/ `fomod`,
    /*priority:*/ 20,
    /*testSupported:*/ toBluebird(async (
      files: string[],
      gameId: string,
      _archivePath?: string,
      details?: ITestSupportedDetails
    ) => {
      return await testSupported(files, gameId, details);
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
        return await install(files, destinationPath, gameId, choices, unattended, details, context.api);
      }
    )
  );

  return true;
}

export default main;
