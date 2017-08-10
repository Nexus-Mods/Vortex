import { types, util } from 'vortex-api';

import {setAutoSortEnabled} from '../actions/settings';

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer: types.IReducerSpec = {
  reducers: {
    [setAutoSortEnabled as any]: (state, payload) => {
      return util.setSafe(state, ['autoSort'], payload);
    },
  },
  defaults: {
    autoSort: true,
  },
};
