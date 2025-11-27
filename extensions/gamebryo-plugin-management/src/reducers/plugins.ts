import { types, util } from 'vortex-api';

import * as actions from '../actions/plugins';

/**
 * reducer for changes to the plugin list
 */
export const pluginsReducer: types.IReducerSpec = {
  reducers: {
    [actions.setPluginList as any]: (state, payload) =>
      util.setSafe(state, ['pluginList'], payload.plugins),
    [actions.setPluginInfo as any]: (state, payload) =>
      util.setSafe(state, ['pluginInfo'], payload.plugins),
    [actions.setPluginFilePath as any]: (state, payload) => {
      const { pluginId, filePath } = payload;
      return util.setSafe(
        util.setSafe(state, ['pluginList', pluginId, 'filePath'], filePath),
        ['pluginInfo', pluginId, 'filePath'], filePath);
    },
    [actions.updatePluginWarnings as any]: (state, payload) =>
      (state.pluginList[payload.id] !== undefined)
        ? util.setSafe(state, ['pluginList', payload.id, 'warnings', payload.warning], payload.value)
        : state,
    [actions.incrementNewPluginCounter as any]: (state, payload) =>
      util.setSafe(state, ['newlyAddedPlugins'], util.getSafe(state, ['newlyAddedPlugins'], 0) + payload.counter),
    [actions.clearNewPluginCounter as any]: (state) =>
      util.setSafe(state, ['newlyAddedPlugins'], 0)
  },
  defaults: {
    pluginList: {},
    pluginInfo: {},
    newlyAddedPlugins: 0,
  },
};
