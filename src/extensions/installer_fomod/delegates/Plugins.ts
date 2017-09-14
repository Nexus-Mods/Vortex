import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';
import {getSafe} from '../../../util/storeHelper';

import DelegateBase from './DelegateBase';

import * as util from 'util';

class Plugins extends DelegateBase {
  constructor(api: IExtensionApi) {
    super(api);
  }

  public isActive =
      (pluginName: string, callback: (err, res: boolean) => void) => {
        try {
          log('debug', 'isActive called', pluginName);
          const state = this.api.store.getState();

          const plugins = Object.keys(getSafe(state, ['session', 'plugins', 'pluginList'], {}));
          // the installer may use a different case than we have on disk
          const localName = plugins.find(plugin =>
            plugin.toLowerCase() === pluginName.toLowerCase());
          if (localName === undefined) {
            // unknown plugin can't be enabled
            return callback(null, false);
          }
          const enabled = getSafe(state, ['loadOrder', localName, 'enabled'], false);
          return callback(null, enabled);
        } catch (err) {
          return callback(err, false);
        }
      }

  public isPresent =
      (pluginName: string, callback: (err, res: boolean) => void) => {
        try {
          log('debug', 'isPresent called', pluginName);
          const state = this.api.store.getState();

          const plugins = Object.keys(getSafe(state, ['session', 'plugins', 'pluginList'], {}));
          const localName = plugins.find(plugin =>
            plugin.toLowerCase() === pluginName.toLowerCase());

          return callback(null, localName !== undefined);
        } catch (err) {
          return callback(err, false);
        }
      }

  public getAll = (isActiveOnly: boolean, callback: (err, res: string[]) => void) => {
    log('debug', 'getAll called', isActiveOnly);
    try {
      const state = this.api.store.getState();
      let plugins = Object.keys(getSafe(state, ['session', 'plugins', 'pluginList'], {}));

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
