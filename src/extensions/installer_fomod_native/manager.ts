import path from 'path';
import { Dirent, readdirSync, readFileSync } from 'node:fs';
import { FileHandle, open, readdir } from 'node:fs/promises';
import { NativeModInstaller, testSupported, types as vetypes, allocWithoutOwnership } from 'fomod-installer-native';
import { hasLoadOrder } from './utils/guards';
import { IExtensionApi, IInstallResult, IState, ISupportedResult } from '../../types/api';
import { getApplication, getGame } from '../../util/api';
import { selectors } from '../..';
import { DialogManager } from './utils/DialogManager';

export class VortexModTester {
  /**
   * Calls FOMOD's testSupport and converts the result to Vortex data
   */
  public testSupport = (files: string[], allowedTypes: string[]): Promise<ISupportedResult> => {
    try {
    const result = testSupported(files, allowedTypes);
    return Promise.resolve({
      supported: result.supported,
      requiredFiles: result.requiredFiles,
    });
    } catch (error) {
      return Promise.resolve({
        supported: false,
        requiredFiles: [],
      });
    }
  };
}

export class VortexModInstaller {
  private modInstaller: NativeModInstaller;
  private api: IExtensionApi;
  private instanceId: string;
  private DialogManager: DialogManager;

  public constructor(api: IExtensionApi, instanceId: string) {
    this.modInstaller = new NativeModInstaller(
      this.pluginsGetAllAsync,
      this.contextGetAppVersionAsync,
      this.contextGetCurrentGameVersionAsync,
      this.contextGetExtenderVersionAsync,
      this.uiStartDialog,
      this.uiEndDialog,
      this.uiUpdateState,
      this.readFileContent,
      this.readDirectoryFileList,
      this.readDirectoryList
    );

    this.api = api;
    this.instanceId = instanceId;
  }

  /**
   * Calls FOMOD's install and converts the result to Vortex data
   */
  public installAsync = async (files: string[], stopPatterns: string[], pluginPath: string, scriptPath: string, preset: any, validate: boolean): Promise<IInstallResult> => {
    try {
      const resultRaw = await this.modInstaller.install(files, stopPatterns, pluginPath, scriptPath, preset, validate);
      return resultRaw as any;
    } catch (error) {
      return {
        instructions: [],
      };
    }
  };

  /**
   * Callback
   */
  private pluginsGetAllAsync = (activeOnly: boolean): Promise<string[]> => {
    const  isPluginEnabled = (state: IState, pluginList: any, plugins: string[], pluginName: string) => {
      const existingPluginName = plugins.find(plugin => plugin.toLowerCase() === pluginName.toLowerCase());
      if (existingPluginName === undefined) {
        // unknown plugin can't be enabled
        return false;
      }
      if (pluginList[existingPluginName].isNative) {
        return true;
      }

      if (!hasLoadOrder(state)) {
        return false;
      }

      return state.loadOrder[existingPluginName]?.enabled ?? false;
    }

    const state = this.api.store.getState();

    const pluginList = state.session.plugins?.pluginList ?? {};
    let plugins = Object.keys(pluginList);
    if (activeOnly === true) {
      plugins = plugins.filter(name => isPluginEnabled(state, pluginList, plugins, name));
    }
    return Promise.resolve(plugins);
  };

  /**
   * Callback
   */
  private contextGetAppVersionAsync = (): Promise<string> => {
    const appVersion = getApplication().version;
    return Promise.resolve(appVersion);
  };
  
  /**
   * Callback
   */
  private contextGetCurrentGameVersionAsync = async (): Promise<string> => {
    const state = this.api.getState();
    const game = selectors.currentGame(state);
    const discovery = selectors.currentGameDiscovery(state);
    const gameInfo = getGame(game.id);
    const version = await gameInfo.getInstalledVersion(discovery);

    return Promise.resolve(version.split(/\-+/)[0]);
  };

  /**
   * Callback
   */
  private contextGetExtenderVersionAsync = async (): Promise<string> => {
    const state = this.api.getState();
    const game = selectors.currentGame(state);
    const discovery = selectors.currentGameDiscovery(state);
    const gameInfo = getGame(game.id);
    const version = await gameInfo.getInstalledVersion(discovery);

    return Promise.resolve(version.split(/\-+/)[0]);
  };
  
  /**
   * Callback for starting FOMOD dialog
   * Delegates to DialogManager instance
   */
  private uiStartDialog = async (
    moduleName: string,
    image: vetypes.IHeaderImage,
    selectCallback: vetypes.SelectCallback,
    contCallback: vetypes.ContinueCallback,
    cancelCallback: vetypes.CancelCallback
  ): Promise<void> => {
    this.DialogManager = new DialogManager(this.api, this.instanceId);
    await this.DialogManager.startDialog(moduleName, image, selectCallback, contCallback, cancelCallback);
  };

  /**
   * Callback for ending FOMOD dialog
   * Delegates to DialogManager instance
   */
  private uiEndDialog = async (): Promise<void> => {
    if (!this.DialogManager) {
      throw new Error('DialogManager not initialized');
    }

    await this.DialogManager.endDialog();

    this.DialogManager.detach();
    this.DialogManager = undefined;
  };

  /**
   * Callback for updating FOMOD dialog state
   * Delegates to DialogManager instance
   */
  private uiUpdateState = async (installSteps: vetypes.IInstallStep[], currentStep: number): Promise<void> => {
    if (!this.DialogManager) {
      throw new Error('DialogManager not initialized');
    }
    await this.DialogManager.updateState(installSteps, currentStep);
  };

  /**
   * Callback
   */
  private readFileContent = (filePath: string, offset: number, length: number): Uint8Array | null => {
    try {
      if (offset === 0 && length === -1) {
        const data = readFileSync(filePath);
        return new Uint8Array(data);
      } else if (offset >= 0 && length > 0) {
        // TODO: read the chunk we actually need, but there's no readFile()
        //const fd = fs.openSync(filePath, 'r');
        //const buffer = Buffer.alloc(length);
        //fs.readSync(fd, buffer, offset, length, 0);
        return new Uint8Array(readFileSync(filePath)).slice(offset, offset + length);
      } else {
        return null;
      }
    } catch {
      return null;
    }
  };

  /**
   * Callback
   */
  private readDirectoryFileList = (directoryPath: string): string[] | null => {
    try {
      return readdirSync(directoryPath, { withFileTypes: true })
        .filter((x: Dirent) => x.isFile())
        .map<string>((x: Dirent) => path.join(directoryPath, x.name));
    } catch {
      return null;
    }
  };

  /**
   * Callback
   */
  private readDirectoryList = (directoryPath: string): string[] | null => {
    try {
      return readdirSync(directoryPath, { withFileTypes: true })
        .filter((x: Dirent) => x.isDirectory())
        .map<string>((x: Dirent) => path.join(directoryPath, x.name));
    } catch {
      return null;
    }
  };

  /**
   * Callback
   */
  private readFileContentAsync = async (
    filePath: string,
    offset: number,
    length: number
  ): Promise<Uint8Array | null> => {
    try {
      let fileHandle: FileHandle | null = null;
      try {
        fileHandle = await open(filePath, 'r');
        if (length === -1) {
          const stats = await fileHandle.stat();
          length = stats.size;
        }
        const buffer = allocWithoutOwnership(length) ?? new Uint8Array(length);
        await fileHandle.read(buffer, 0, length, offset);
        return buffer;
      } finally {
        await fileHandle?.close();
      }
    } catch (err) {
      // ENOENT means that a file or folder is not found, it's an expected error
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return null;
      }
      //const { localize: t } = LocalizationManager.getInstance(this.api);
      //this.api.showErrorNotification?.(t('Error reading file content'), err);
    }
    return null;
  };

  /**
   * Callback
   */
  private readDirectoryFileListAsync = async (directoryPath: string): Promise<string[] | null> => {
    try {
      const dirs = await readdir(directoryPath, { withFileTypes: true });
      const res = dirs.filter((x) => x.isFile()).map<string>((x) => path.join(directoryPath, x.name));
      return res;
    } catch (err) {
      // ENOENT means that a file or folder is not found, it's an expected error
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return null;
      }
      //const { localize: t } = LocalizationManager.getInstance(this.api);
      //this.api.showErrorNotification?.(t('Error reading directory file list'), err);
    }
    return null;
  };

  /**
   * Callback
   */
  private readDirectoryListAsync = async (directoryPath: string): Promise<string[] | null> => {
    try {
      const dirs = await readdir(directoryPath, { withFileTypes: true });
      const res = dirs.filter((x) => x.isDirectory()).map<string>((x) => path.join(directoryPath, x.name));
      return res;
    } catch (err) {
      // ENOENT means that a file or folder is not found, it's an expected error
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return null;
      }
      //const { localize: t } = LocalizationManager.getInstance(this.api);
      //this.api.showErrorNotification?.(t('Error reading directory list'), err);
    }
    return null;
  };
}
