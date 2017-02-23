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

        if (state.loadOrder !== undefined && Object.keys(state.loadOrder).length > 0) {
          log('info', 'isPresent debug state', util.inspect(pluginName));
          let plugins = Object.keys(state.session.plugins.pluginList);
          plugins.forEach((plugin) => {
            if ((plugin !== undefined) &&
                (plugin.toLowerCase() === pluginName.toLowerCase())) {
              return callback(null, state.loadOrder[plugin].enabled);
            }
          });
        }
        return callback(null, false);
      }

  public isPresent =
      (pluginName: string, callback: (err, res: boolean) => void) => {
        log('info', 'isPresent called', util.inspect(pluginName));
        let state = this.api.store.getState();

        if (state.session.plugins !== undefined && state.session.plugins.pluginList !== undefined) {
          log('info', 'isPresent debug state', util.inspect(pluginName));
          let plugins = Object.keys(state.session.plugins.pluginList);
          plugins.forEach((plugin) => {
            if ((plugin !== undefined) &&
                (plugin.toLowerCase() === pluginName.toLowerCase())) {
              return callback(null, true);
            }
          });
        }
        return callback(null, false);
      }

  public getAll = (isActiveOnly: boolean, callback: (err, res: string[]) => void) => {
    log('info', 'getAll called', util.inspect(isActiveOnly));
    let state = this.api.store.getState();

    if (state.loadOrder !== undefined && Object.keys(state.loadOrder).length > 0) {
      log('info', 'getAll debug state', util.inspect(isActiveOnly));
      if (isActiveOnly === true) {
        let plugins = Object.keys(state.session.plugins.pluginList);
        return callback(null, plugins.filter((plugin) =>
          (state.loadOrder[plugin] !== undefined && state.loadOrder[plugin].enabled)));
      } else {
        let plugins = Object.keys(state.session.plugins.pluginList);
        return callback(null, plugins);
      }
    }

    return callback(null, []);
  }
}

export default Plugins;
