import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';
import * as util from 'util';

export class Plugins {
  private mExtensionApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mExtensionApi = api;
  }

  public IsActive = (pluginName: string): boolean => {
    log('info', 'IsActive called', util.inspect(pluginName));
    let state = this.mExtensionApi.store.getState();

    if (state.loadOrder !== undefined) {
      log('info', 'IsPresent debug state', util.inspect(pluginName));
      state.loadOrder.forEach((plugin) => {
      if ((plugin.key !== undefined) && (plugin.key.toLowerCase() === pluginName.toLowerCase())) {
          return plugin.enabled;
        }
      });
    }
    return false;
  }

  public IsPresent = (pluginName: string): boolean => {
    log('info', 'IsPresent called', util.inspect(pluginName));
    let state = this.mExtensionApi.store.getState();

    if (state.loadOrder !== undefined) {
      log('info', 'IsPresent debug state', util.inspect(pluginName));
      state.loadOrder.forEach((plugin) => {
      if ((plugin.key !== undefined) && (plugin.key.toLowerCase() === pluginName.toLowerCase())) {
          return true;
        }
      });
    }
    return false;
  }

  public GetAll = (isActiveOnly: boolean): string[] => {
    log('info', 'GetAll called', util.inspect(isActiveOnly));
    let state = this.mExtensionApi.store.getState();

    if (state.loadOrder !== undefined) {
      log('info', 'GetAll debug state', util.inspect(isActiveOnly));
      if (isActiveOnly === true) {
        return state.loadOrder.filter(plugin => plugin.enabled === true);
      } else {
        return state.loadOrder;
      }
    }

    return undefined;
  }
}

export default Plugins;
