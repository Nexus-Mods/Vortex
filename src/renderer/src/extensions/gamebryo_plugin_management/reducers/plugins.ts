import type { types } from "@nexusmods/vortex-api";
import update from "immutability-helper";

import * as actions from "../actions/plugins";

/**
 * reducer for changes to the plugin list
 */
export const pluginsReducer: types.IReducerSpec = {
  reducers: {
    [actions.setPluginList as any]: (state, payload) =>
      update(state, { pluginList: { $set: payload.plugins ?? {} } }),
    [actions.setPluginInfo as any]: (state, payload) =>
      update(state, { pluginInfo: { $set: payload.plugins } }),
    [actions.setPluginFilePath as any]: (state, payload) => {
      const { pluginId, filePath } = payload;
      const withFilePath = (map: Record<string, any> = {}) => ({
        ...map,
        [pluginId]: { ...(map[pluginId] ?? {}), filePath },
      });
      return update(state, {
        pluginList: { $set: withFilePath(state.pluginList) },
        pluginInfo: { $set: withFilePath(state.pluginInfo) },
      });
    },
    [actions.updatePluginWarnings as any]: (state, payload) => {
      if (state.pluginList?.[payload.id] === undefined) {
        return state;
      }
      const warnings = state.pluginList[payload.id].warnings ?? {};
      return update(state, {
        pluginList: {
          [payload.id]: { warnings: { $set: { ...warnings, [payload.warning]: payload.value } } },
        },
      });
    },
    [actions.incrementNewPluginCounter as any]: (state, payload) =>
      update(state, {
        newlyAddedPlugins: { $set: (state.newlyAddedPlugins ?? 0) + payload.counter },
      }),
    [actions.clearNewPluginCounter as any]: (state) =>
      update(state, { newlyAddedPlugins: { $set: 0 } }),
  },
  defaults: {
    pluginList: {},
    pluginInfo: {},
    newlyAddedPlugins: 0,
  },
};
