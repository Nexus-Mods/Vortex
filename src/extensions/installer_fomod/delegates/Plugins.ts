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
          let state = this.api.store.getState();

          let plugins = Object.keys(getSafe(state, ['session', 'plugins', 'pluginList'], {}));
          // the installer may use a different case than we have on disk
          pluginName = plugins.find((plugin) => plugin.toLowerCase() ===
                                                pluginName.toLowerCase());
          const enabled =
              getSafe(state, ['loadOrder', pluginName, 'enabled'], false);
          return callback(null, enabled);
        } catch (err) {
          return callback(err, false);
        }
      }

  public isPresent =
      (pluginName: string, callback: (err, res: boolean) => void) => {
        try {
          log('info', 'isPresent called', util.inspect(pluginName));
          let state = this.api.store.getState();

          let plugins = Object.keys(getSafe(state, ['session', 'plugins', 'pluginList'], {}));
          pluginName = plugins.find((plugin) => plugin.toLowerCase() === pluginName.toLowerCase());

          return callback(null, pluginName !== undefined);
        } catch (err) {
          return callback(err, false);
        }
      }

  public getAll = (isActiveOnly: boolean, callback: (err, res: string[]) => void) => {
    log('info', 'getAll called', util.inspect(isActiveOnly));
    try {
      let state = this.api.store.getState();
      let plugins = Object.keys(getSafe(state, ['session', 'plugins', 'pluginList'], {}));

      log('info', 'getAll debug state', util.inspect(isActiveOnly));
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
