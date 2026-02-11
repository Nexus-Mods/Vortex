import { discoveryByGame } from "../../gamemode_management/selectors";
import { IState } from "../../../types/IState";
import { IExtensionApi } from "../../../types/IExtensionContext";
import { getApplication } from "../../../util/application";
import { getGame } from "../../gamemode_management/util/getGame";
import { hasLoadOrder, hasSessionPlugins } from "../utils/guards";

/**
 * Core delegates for FOMOD installer IPC communication
 * These are called by the C# installer process to query game/mod state
 */
export class SharedDelegates {
  public static async create(
    api: IExtensionApi,
    gameId: string,
  ): Promise<SharedDelegates> {
    const delegates = new SharedDelegates(api);
    await delegates.initialize(gameId);
    return delegates;
  }

  private mApi: IExtensionApi;
  private mGameVersion: string | null = null;

  private constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  private initialize = async (gameId: string): Promise<void> => {
    const state = this.mApi.getState();
    const discovery = discoveryByGame(state, gameId);
    const gameInfo = getGame(gameId);
    this.mGameVersion =
      (await gameInfo?.getInstalledVersion?.(discovery)) ?? null;
  };

  /**
   * Get the application version
   */
  public getAppVersion = (): string => {
    try {
      return getApplication().version;
    } catch (error) {
      return "";
    }
  };

  /**
   * Get the current game version
   */
  public getCurrentGameVersion = (): string => {
    try {
      return this.mGameVersion.split(/\-+/)[0];
    } catch (error) {
      return "";
    }
  };

  /**
   * Get the version of a script extender (e.g., SKSE, F4SE)
   */
  public getExtenderVersion = (extender: string): string => {
    try {
      return this.mGameVersion.split(/\-+/)[0];
    } catch (error) {
      return "";
    }
  };

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

      // Include plugins from mods installed during active collection session
      // that haven't been deployed yet
      const collectionPlugins: string[] =
        state.session?.collections?.activeSession?.installedPlugins ??
        [];
      if (collectionPlugins.length > 0) {
        const existing = new Set(plugins.map((p) => p.toLowerCase()));
        for (const cp of collectionPlugins) {
          if (!existing.has(cp.toLowerCase())) {
            plugins.push(cp);
          }
        }
      }

      if (activeOnly === true) {
        plugins = plugins.filter((name) =>
          this.isPluginEnabled(state, pluginList, plugins, name),
        );
      }
      return plugins;
    } catch (error) {
      return [];
    }
  };

  private isPluginEnabled = (
    state: IState,
    pluginList: any,
    plugins: string[],
    pluginName: string,
  ) => {
    const existingPluginName = plugins.find(
      (plugin) => plugin.toLowerCase() === pluginName.toLowerCase(),
    );
    if (existingPluginName === undefined) {
      // unknown plugin can't be enabled
      return false;
    }
    if (pluginList[existingPluginName] === undefined) {
      // Plugin from collection tracking, not yet in pluginList — check loadOrder
      if (!hasLoadOrder(state)) {
        return false;
      }
      return state.loadOrder[existingPluginName]?.enabled ?? false;
    }

    if (pluginList[existingPluginName].isNative) {
      return true;
    }

    if (!hasLoadOrder(state)) {
      return false;
    }

    return state.loadOrder[existingPluginName]?.enabled ?? false;
  };
}
