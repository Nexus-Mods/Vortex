import {IExtensionContext} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';
import * as util from 'util';

export class Plugins {
  private mCurrentContext: IExtensionContext;

  constructor(context: IExtensionContext) {
    this.mCurrentContext = context;
  }

  public isActive (pluginName: string): boolean {
    log('info', 'isActive called', util.inspect(pluginName));
    let state = this.mCurrentContext.api.store.getState();

    if (state.loadOrder !== undefined) {
      state.loadOrder.forEach((plugin) => {
      if ((plugin.key !== undefined) && (plugin.key.toLowerCase() === pluginName.toLowerCase())) {
          return plugin.enabled;
        }
      });
    }
    return false;
  }

  public isPresent (pluginName: string): boolean {
    log('info', 'isPresent called', util.inspect(pluginName));
    let state = this.mCurrentContext.api.store.getState();

    if (state.loadOrder !== undefined) {
      state.loadOrder.forEach((plugin) => {
      if ((plugin.key !== undefined) && (plugin.key.toLowerCase() === pluginName.toLowerCase())) {
          return true;
        }
      });
    }
    return false;
  }

  public GetAll (isActiveOnly: boolean): string[] {
    log('info', 'GetAll called', util.inspect(isActiveOnly));
    let state = this.mCurrentContext.api.store.getState();

    if (state.loadOrder !== undefined) {
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
