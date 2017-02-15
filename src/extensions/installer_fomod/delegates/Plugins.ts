import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';

import DelegateBase from './delegateBase';

import * as util from 'util';

class Plugins extends DelegateBase {
  constructor(api: IExtensionApi) {
    super(api);
  }

  public isActive =
      (pluginName: string, callback: (err, res: boolean) => void) => {
        log('info', 'isActive called', util.inspect(pluginName));
        let state = this.api.store.getState();

        if (state.loadOrder !== undefined) {
          log('info', 'isPresent debug state', util.inspect(pluginName));
          state.loadOrder.forEach((plugin) => {
            if ((plugin.key !== undefined) &&
                (plugin.key.toLowerCase() === pluginName.toLowerCase())) {
              return callback(null, plugin.enabled);
            }
          });
        }
        return callback(null, false);
      }

  public isPresent =
      (pluginName: string, callback: (err, res: boolean) => void) => {
        log('info', 'isPresent called', util.inspect(pluginName));
        let state = this.api.store.getState();

        if (state.loadOrder !== undefined) {
          log('info', 'isPresent debug state', util.inspect(pluginName));
          state.loadOrder.forEach((plugin) => {
            if ((plugin.key !== undefined) &&
                (plugin.key.toLowerCase() === pluginName.toLowerCase())) {
              return callback(null, true);
            }
          });
        }
        return callback(null, false);
      }

  public getAll = (isActiveOnly: boolean, callback: (err, res: string[]) => void) => {
    log('info', 'getAll called', util.inspect(isActiveOnly));
    let state = this.api.store.getState();

    if (state.loadOrder !== undefined) {
      log('info', 'getAll debug state', util.inspect(isActiveOnly));
      if (isActiveOnly === true) {
        return callback(null, state.loadOrder.filter((plugin) => plugin.enabled));
      } else {
        return callback(null, state.loadOrder);
      }
    }

    return callback(null, []);
  }
}

export default Plugins;
