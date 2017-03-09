import * as actions from '../actions/loadOrder';
import {ILoadOrder} from '../types/ILoadOrder';

import {types, util} from 'nmm-api';

type LoadOrderMap = { [name: string]: ILoadOrder };

/**
 * reducer for changes to the plugin list
 */
export const loadOrderReducer: types.IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']: (state, payload) => {
      if (payload.hasOwnProperty('loadOrder')) {
        return util.setSafe(state, [], payload.loadOrder);
      } else {
        return state;
      }
    },
    [actions.setPluginEnabled as any]:
        (state, payload) => util.setSafe(state, [payload.pluginName, 'enabled'],
                                         payload.enabled),
    [actions.updateLoadOrder as any]: (state, payload: string[]) => {
      let copy = Object.assign({}, state);
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
      let copy = Object.assign({}, state);
      Object.keys(copy).forEach((pluginName: string) => {
        copy[pluginName].loadOrder = payload.indexOf(pluginName);
      });
      return copy;
    },
  },
  defaults: {},
};
