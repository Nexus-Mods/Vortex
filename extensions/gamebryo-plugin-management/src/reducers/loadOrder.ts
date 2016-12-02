import { log, types, util } from 'nmm-api';

import * as actions from '../actions/loadOrder';
import {ILoadOrder} from '../types/ILoadOrder';

import * as nodeUtil from 'util';
import update = require('react-addons-update');

type LoadOrderMap = { [name: string]: ILoadOrder };

function updateModIndices(input: LoadOrderMap) {
  let idx = 0;
  let sorted = Object.keys(input).sort(
    (lhs: string, rhs: string) => input[lhs].loadOrder - input[rhs].loadOrder);
  sorted.forEach((name: string) => {
    if (input[name].enabled) {
      input[name].modIndex = idx++;
    } else {
      input[name].modIndex = -1;
    }
  });
  return input;
}

/**
 * reducer for changes to the plugin list
 */
export const loadOrderReducer: types.IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']:
        (state, payload) => {
          if (payload.hasOwnProperty('loadOrder')) {
            let res: LoadOrderMap = util.setSafe(state, [], payload.loadOrder);
            return updateModIndices(res);
          } else {
            return state;
          }
        },
    [actions.setPluginEnabled]:
        (state, payload) => {
          let res = util.setSafe(state, [payload.pluginName, 'enabled'], payload.enabled);
          return updateModIndices(res);
        },
  },
  defaults: {
  },
};

