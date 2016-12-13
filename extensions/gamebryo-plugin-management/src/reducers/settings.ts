import { types, util } from 'nmm-api';

import {
  setAutoSortEnabled,
  setPluginlistAttributeSort,
  setPluginlistAttributeVisible } from '../actions/settings';

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer: types.IReducerSpec = {
  reducers: {
    [setPluginlistAttributeVisible]: (state, payload) => {
      return util.setSafe(state,
                          ['pluginlistState', payload.attributeId, 'enabled'],
                          payload.visible);
    },
    [setPluginlistAttributeSort]: (state, payload) => {
      const {attributeId, direction} = payload;
      return util.setSafe(
          state, ['pluginlistState', attributeId, 'sortDirection'], direction);
    },
    [setAutoSortEnabled]: (state, payload) => {
      return util.setSafe(state, ['autoSort'], payload);
    },
  },
  defaults: {
    pluginlistState: {
      loadOrder: { sortDirection: 'asc' },
    },
    autoSort: true,
  },
};
