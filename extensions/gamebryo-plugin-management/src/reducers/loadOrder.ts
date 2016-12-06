import {types, util} from 'nmm-api';

import * as actions from '../actions/loadOrder';
import {ILoadOrder} from '../types/ILoadOrder';

type LoadOrderMap = { [name: string]: ILoadOrder };

/**
 * reducer for changes to the plugin list
 */
export const loadOrderReducer: types.IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']:
        (state, payload) => {
          if (payload.hasOwnProperty('loadOrder')) {
            return util.setSafe(state, [], payload.loadOrder);
          } else {
            return state;
          }
        },
    [actions.setPluginEnabled]:
        (state, payload) => {
          return util.setSafe(state, [payload.pluginName, 'enabled'], payload.enabled);
        },
  },
  defaults: {
  },
};
