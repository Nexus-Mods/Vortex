import { types, util } from 'vortex-api';

import * as actions from '../actions/settings';

import update from 'immutability-helper';

/**
 * reducer for changes to ephemeral session state
 */
export const settingsReducer: types.IReducerSpec = {
  reducers: {
    [actions.enableMonitor as any]: (state, payload) => {
      return util.setSafe(state, ['monitorEnabled'], payload);
    },
  },
  defaults: {
    monitorEnabled: true,
  },
};
