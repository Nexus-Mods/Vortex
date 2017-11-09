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
      let result = state;
      payload.forEach((pluginName: string, idx: number) => {
        result = util.setSafe(result, [pluginName, 'loadOrder'], idx);
      });
      return result;
    },
  },
  defaults: {},
};
