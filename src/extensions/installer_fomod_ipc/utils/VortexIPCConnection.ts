import { BaseIPCConnection, ConnectionStrategy, TimeoutOptions } from 'fomod-installer-ipc';
import { ISupportedResult } from '../../mod_management/types/TestSupported';
import { IInstallResult } from '../../mod_management/types/IInstallResult';
import { fs } from '../../..';
import { IExtensionApi } from '../../../types/api';
import { log } from '../../../util/log';
import { IChoices } from '../../installer_fomod_shared/types/interface';
import path from 'path';
import { getVortexPath } from '../../../util/api';

/**
 * Vortex-specific IPC connection implementation
 * Extends BaseIPCConnection with Vortex API integration:
 * - Vortex logging system
 * - Vortex file system (fs) utilities
 * - Vortex path resolution (getVortexPath)
 * - Vortex dialog system (showDialog/closeDialog)
 * - FOMOD-specific commands (testSupported, install)
 */
export class VortexIPCConnection extends BaseIPCConnection {
  private api: IExtensionApi | undefined;

  /**
   * Create a new Vortex IPC connection with fallback strategies
   *
   * @param strategies Array of transport-launcher pairs to try (in order)
   * @param connectionTimeout Timeout in milliseconds (default: 10000)
   * @param api Optional Vortex API for showing dialogs and translations
   *
   * @example
   * const connection = new VortexIPCConnection([
   *   { transport: namedPipeTransport, launcher: sandboxLauncher },
   *   { transport: tcpTransport, launcher: regularLauncher }
   * ], 10000, api);
   */
  constructor(
    strategies: ConnectionStrategy | ConnectionStrategy[],
    connectionTimeout: number = 10000,
    api?: IExtensionApi
  ) {
    // Create timeout options with Vortex dialog integration
    const timeoutOptions: TimeoutOptions = {
      showDialog: !!api,
      onTimeoutDialog: api ? async (dialogId: string, command?: string) => {
        const modName = ''; // Placeholder for mod name if needed
        const t = api.translate;
        const cont = t('Continue Installation');
        const cancel = t('Cancel');

        const result = await api.showDialog?.('question', 'Installation Timeout', {
          text: t(
            `The installation of mod {{ modName }} is taking longer than expected.\n` +
            `This may happen because the mod has a custom dialog that Vortex is not aware of.\n` +
            `In this case, you may need to interact with the mod's installer manually outside of Vortex to proceed.`,
            { replace: { modName: modName } }),
          message: t('Would you like to continue with the installation, or cancel it?'),
        }, [{ label: cont }, { label: cancel }], dialogId);

        return result && result.action === cont;
      } : undefined,
      onDismissDialog: api ? (dialogId: string) => {
        api.closeDialog?.(dialogId);
      } : undefined
    };

    super(strategies, connectionTimeout, timeoutOptions);
    this.api = api;
  }

  protected getExecutablePaths(exeName: string): string[] {
    const paths = super.getExecutablePaths(exeName);
    paths.push(path.join(getVortexPath('base'), 'resources', 'app.asar.unpacked', 'node_modules', 'fomod-installer-ipc', 'dist', exeName));
    return paths;
  }

  /**
   * Implement logging using Vortex log system
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: any): void {
    log(level, message, metadata);
  }

  /**
   * Implement file existence check using Vortex fs utilities
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.statAsync(filePath);
      return stat.isFile();
    } catch (err) {
      return false;
    }
  }

  /**
   * Send TestSupported command to check if files are supported by a FOMOD installer
   */
  public async testSupported(files: string[], allowedTypes: string[]): Promise<ISupportedResult> {
    const response = await this.sendCommand('TestSupported', {
      files,
      allowedTypes,
    });

    return {
      supported: response?.supported ?? false,
      requiredFiles: response?.requiredFiles ?? [],
    };
  }

  /**
   * Send Install command to perform FOMOD installation
   */
  public async install(
    files: string[],
    stopPatterns: string[],
    pluginPath: string | null,
    scriptPath: string,
    fomodChoices: IChoices,
    validate: boolean
  ): Promise<IInstallResult> {
    // Grant access to the mod installation directory if using sandbox
    // scriptPath is the destinationPath where mod files are being installed
    if (scriptPath) {
      await this.grantAdditionalAccess([scriptPath]);
    }

    const response = await this.sendCommand('Install', {
      files,
      stopPatterns,
      pluginPath,
      scriptPath,
      fomodChoices,
      validate,
    });

    return response;
  }
}
