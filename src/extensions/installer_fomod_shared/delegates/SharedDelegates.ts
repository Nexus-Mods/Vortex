import { currentGame, currentGameDiscovery } from '../../gamemode_management/selectors';
import { IState } from '../../../types/IState';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { getApplication } from '../../../util/application';
import { getGame } from '../../gamemode_management/util/getGame';
import { hasLoadOrder, hasSessionPlugins } from '../utils/guards';

/**
 * Core delegates for FOMOD installer IPC communication
 * These are called by the C# installer process to query game/mod state
 */
export class SharedDelegates {
  public static async create(api: IExtensionApi): Promise<SharedDelegates> {
    const delegates = new SharedDelegates(api);
    await delegates.initialize();
    return delegates;
  }

  private mApi: IExtensionApi;
  private mGameVersion: string | null = null;

  private constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  private initialize = async (): Promise<void> => {
    const state = this.mApi.getState();
    const game = currentGame(state);
    const discovery = currentGameDiscovery(state);
    const gameInfo = getGame(game.id);
    this.mGameVersion = await gameInfo.getInstalledVersion(discovery);
  }

  /**
   * Get the application version
   */
  public getAppVersion = (): string => {
    try {
      return getApplication().version;
    } catch (error) {
      return '';
    }
  }

  /**
   * Get the current game version
   */
  public getCurrentGameVersion = (): string => {
    try {
      return this.mGameVersion.split(/\-+/)[0];
    } catch (error) {
      return '';
    }
  }

  /**
   * Get the version of a script extender (e.g., SKSE, F4SE)
   */
  public getExtenderVersion = (extender: string): string => {
    try {
      return this.mGameVersion.split(/\-+/)[0];
    } catch (error) {
      return '';
    }
  }

  /**
   * Get all plugins (mods with .esp/.esm/.esl files)
   */
  public getAllPlugins = (activeOnly: boolean): string[] => {
    try {
      const state = this.mApi.getState();
      if (!hasSessionPlugins(state.session)) {
        return [];
      }

      const pluginList = state.session.plugins?.pluginList ?? {};
      let plugins = Object.keys(pluginList);
      if (activeOnly === true) {
        plugins = plugins.filter(name => this.isPluginEnabled(state, pluginList, plugins, name));
      }
      return plugins;
    } catch (error) {
      return [];
    }
  }

  private isPluginEnabled = (state: IState, pluginList: any, plugins: string[], pluginName: string) => {
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
}
