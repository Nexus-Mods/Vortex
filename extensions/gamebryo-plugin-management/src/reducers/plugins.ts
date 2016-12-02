import { types, util } from 'nmm-api';

import * as actions from '../actions/plugins';

/**
 * reducer for changes to the plugin list
 */
export const pluginsReducer: types.IReducerSpec = {
  reducers: {
    [actions.setPluginList]:
        (state, payload) => {
          return util.setSafe(state, ['pluginList'], payload.plugins);
        },
  },
  defaults: {
    pluginList: [],
  },
};
