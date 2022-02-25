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
          return callback(null, this.isEnabled(state, pluginList, plugins, pluginName));
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

      const pluginList = state.session.plugins?.pluginList ?? {};
      let plugins = Object.keys(pluginList);

      if (isActiveOnly === true) {
        plugins = plugins.filter(name => this.isEnabled(state, pluginList, plugins, name));
      }
      return callback(null, plugins);
    } catch (err) {
      return callback(err, null);
    }
  }

  private isEnabled(state: any, pluginList: any, plugins: string[], pluginName: string) {
    const localName = plugins.find(plugin =>
      plugin.toLowerCase() === pluginName.toLowerCase());
    if (localName === undefined) {
      // unknown plugin can't be enabled
      return false;
    }
    return pluginList[localName].isNative
      || (state.loadOrder?.[localName]?.enabled ?? false);
  }
}

export default Plugins;
