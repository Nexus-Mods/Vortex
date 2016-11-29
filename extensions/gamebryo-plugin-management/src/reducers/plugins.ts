import { log, types, util } from 'nmm-api';

import * as actions from '../actions/plugins';

import * as nodeUtil from 'util';

/**
 * reducer for changes to the plugin list
 */
export const pluginsReducer: types.IReducerSpec = {
  reducers: {
    [actions.setPluginList]:
        (state, payload) => {
          return util.setSafe(state, ['profiles', payload.profile, 'pluginList'], payload.plugins);
        },
    [actions.setPluginEnabled]:
        (state, payload) => {
          let currentProfile = state.currentProfile;
          log('info', 'before', nodeUtil.inspect(state));
          let res = util.setSafe(state, ['profiles', currentProfile, 'pluginList',
                                      payload.pluginName, 'enabled'], payload.enabled);
          log('info', 'after', nodeUtil.inspect(state));
          return res;
        },
  },
  defaults: {
    profiles: {
      default: {
        pluginList: [],
      },
    },
  },
};
