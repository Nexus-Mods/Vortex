import path from 'path';
import { Dirent, readdirSync, readFileSync } from 'node:fs';
import { FileHandle, open, readdir } from 'node:fs/promises';
import { NativeModInstaller, types as vetypes, allocWithoutOwnership } from 'fomod-installer-native';
import { hasLoadOrder } from './guards';
import { IExtensionApi, IState } from '../../../types/api';
import { getApplication, getGame } from '../../../util/api';
import { log, selectors } from '../../..';
import { DialogManager } from './DialogManager';

export class VortexModInstaller {
  private mModInstaller: NativeModInstaller;
  private mApi: IExtensionApi;
  private mInstanceId: string;
  private mScriptPath: string;
  private mDialogManager: DialogManager;

  public constructor(api: IExtensionApi, instanceId: string) {
    this.mModInstaller = new NativeModInstaller(
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

    this.mApi = api;
    this.mInstanceId = instanceId;
  }

  public dispose() {
    this.mDialogManager?.dispose();
    this.mDialogManager = undefined;
  }

  /**
   * Calls FOMOD's install and converts the result to Vortex data
   */
  public installAsync = async (files: string[], stopPatterns: string[], pluginPath: string, scriptPath: string, preset: any, validate: boolean): Promise<vetypes.InstallResult | null> => {
    try {
      this.mScriptPath = scriptPath;
      return await this.mModInstaller.install(files, stopPatterns, pluginPath, scriptPath, preset, validate);
    } catch (error) {
      return null;
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

    const state = this.mApi.store.getState();

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
    const state = this.mApi.getState();
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
    const state = this.mApi.getState();
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
    log('debug', 'Starting FOMOD dialog', { instanceId: this.mInstanceId });
    this.mDialogManager = new DialogManager(this.mApi, this.mInstanceId, this.mScriptPath);
    await this.mDialogManager.enqueueDialog(moduleName, image, selectCallback, contCallback, cancelCallback);
  };

  /**
   * Callback for updating FOMOD dialog state
   * Delegates to DialogManager instance
   */
  private uiUpdateState = async (installSteps: vetypes.IInstallStep[], currentStepId: number): Promise<void> => {
    if (!this.mDialogManager) {
      throw new Error('DialogManager not initialized');
    }

    // https://github.com/Nexus-Mods/NexusMods.App/blob/e6b99cff84443ce78081caefda7ffcd4ffc184a9/src/NexusMods.Games.FOMOD/CoreDelegates/UiDelegate.cs#L108-L109
    if (currentStepId < 0 || currentStepId >= installSteps.length) {
      return;
      //throw new Error('Invalid current step ID');
    }

    log('debug', 'Updating FOMOD dialog state', {
      instanceId: this.mInstanceId,
      currentStepId,
      totalSteps: installSteps.length,
    });
    await this.mDialogManager.updateDialogState(installSteps, currentStepId);
  };

  /**
   * Callback for ending FOMOD dialog
   * Delegates to DialogManager instance
   */
  private uiEndDialog = async (): Promise<void> => {
    if (!this.mDialogManager) {
      throw new Error('DialogManager not initialized');
    }

    log('debug', 'Ending FOMOD dialog', { instanceId: this.mInstanceId });

    await this.mDialogManager.endDialog();
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
