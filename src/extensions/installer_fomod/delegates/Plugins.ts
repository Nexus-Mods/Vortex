import {IExtensionApi} from '../../../types/IExtensionContext';
import {getSafe} from '../../../util/storeHelper';

import { getNativePlugins } from '../util/gameSupport';
import DelegateBase from './DelegateBase';

class Plugins extends DelegateBase {
  private mGameId: string;
  constructor(api: IExtensionApi, gameId: string) {
    super(api);
    this.mGameId = gameId;
  }

  public isActive =
      (pluginName: string, callback: (err, res: boolean) => void) => {
        try {
          const state = this.api.store.getState();

          const pluginList = state.session.plugins?.pluginList ?? {};

          const plugins = Object.keys(pluginList);
          // the installer may use a different case than we have on disk
          const localName = plugins.find(plugin =>
            plugin.toLowerCase() === pluginName.toLowerCase());
          if (localName === undefined) {
            // unknown plugin can't be enabled
            return callback(null, false);
          }
          const enabled = pluginList[localName].isNative
                        || (state.loadOrder?.[localName]?.enabled ?? false);
          return callback(null, enabled);
        } catch (err) {
          return callback(err, false);
        }
      }

  public isPresent =
      (pluginName: string, callback: (err, res: boolean) => void) => {
        try {
          const state = this.api.store.getState();

          const plugins = Object.keys(
            getSafe(state, ['session', 'plugins', 'pluginList'], undefined) ?? {});
          const localName = plugins.find(plugin =>
            plugin.toLowerCase() === pluginName.toLowerCase());

          return callback(null, localName !== undefined);
        } catch (err) {
          return callback(err, false);
        }
      }

  public getAll = (isActiveOnly: boolean, callback: (err, res: string[]) => void) => {
    try {
      const state = this.api.store.getState();
      let plugins = Object.keys(
        getSafe(state, ['session', 'plugins', 'pluginList'], undefined) ?? {});

      if (isActiveOnly === true) {
        plugins =
            plugins.filter((plugin) => getSafe(
                               state, ['loadOrder', plugin, 'enabled'], false));
      }
      return callback(null, plugins);
    } catch (err) {
      return callback(err, null);
    }
  }
}

export default Plugins;
