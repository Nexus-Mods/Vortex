import { types, util } from 'vortex-api';

import * as actions from '../actions/settings';

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer: types.IReducerSpec = {
  reducers: {
    [actions.setAutoSortEnabled as any]: (state, payload) =>
      util.setSafe(state, ['autoSort'], payload),
    [actions.setAutoEnable as any]: (state, payload) =>
      util.setSafe(state, ['autoEnable'], payload),
    [actions.setPluginManagementEnabled as any]: (state, payload) => {
      const { profileId, enabled } = payload;
      return util.setSafe(state, ['pluginManagementEnabled', profileId], enabled);
    }
  },
  defaults: {
    autoSort: true,
    autoEnable: false,
  },
};
