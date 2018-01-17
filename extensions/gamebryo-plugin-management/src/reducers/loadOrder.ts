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
    [actions.setPluginOrder as any]: (state, payload) => {
      const result = {};
      payload.forEach((pluginName: string, idx: number) => {
        result[pluginName] = {
          enabled: util.getSafe(state, [pluginName, 'enabled'], true),
          loadOrder: idx,
        };
      });
      return result;
    },
  },
  defaults: {},
};
