import * as actions from '../actions/loadOrder';
import {ILoadOrder} from '../types/ILoadOrder';

import {types, util} from 'vortex-api';

interface ILoadOrderMap {
  [name: string]: ILoadOrder;
}

/**
 * reducer for changes to the plugin list
 */
export const loadOrderReducer: types.IReducerSpec = {
  reducers: {
    [actions.setPluginEnabled as any]:
        (state, payload) => util.setSafe(state, [payload.pluginName, 'enabled'],
                                         payload.enabled),
    [actions.updateLoadOrder as any]: (state, payload: string[]) => {
      const copy = { ...state };
      Object.keys(state).forEach((name: string) => {
        if (payload.indexOf(name) === -1) {
          delete copy[name];
        }
      });
      let count = Object.keys(state).length;
      payload.forEach((name: string) => {
        if (copy[name] === undefined) {
          copy[name] = {
            enabled: false,
            loadOrder: count++,
          };
        }
      });
      return copy;
    },
    [actions.setPluginOrder as any]: (state, payload) => {
      const copy = { ...state };
      Object.keys(copy).forEach((pluginName: string) => {
        copy[pluginName].loadOrder = payload.indexOf(pluginName);
      });
      return copy;
    },
  },
  defaults: {},
};
