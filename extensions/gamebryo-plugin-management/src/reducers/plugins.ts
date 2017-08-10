import { types, util } from 'vortex-api';

import * as actions from '../actions/plugins';

/**
 * reducer for changes to the plugin list
 */
export const pluginsReducer: types.IReducerSpec = {
  reducers: {
    [actions.setPluginList as any]: (state, payload) =>
      util.setSafe(state, ['pluginList'], payload.plugins)
    ,
    [actions.setLootActivity as any]: (state, payload) =>
      util.setSafe(state, ['lootActivity'], payload)
    ,
  },
  defaults: {
    pluginList: [],
    lootActivity: undefined,
  },
};
