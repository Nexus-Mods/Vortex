import update from "immutability-helper";

import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/plugins";
import type { IPluginCombined, IPlugins } from "../types/IPlugins";

/** session.plugins: the plugins found on disk and everything gathered about them */
export interface IPluginsSessionState {
  // keyed by plugin id
  pluginList: IPlugins;
  // keyed by plugin id
  pluginInfo: { [id: string]: IPluginCombined };
  newlyAddedPlugins: number;
}

declare module "@/types/IState" {
  interface ISessionState {
    plugins: IPluginsSessionState;
  }
}

/**
 * reducer for changes to the plugin list
 */
export const pluginsReducer = actionsToReducerSpec<IPluginsSessionState, typeof actions>(
  {
    pluginList: {},
    pluginInfo: {},
    newlyAddedPlugins: 0,
  },
  actions,
  {
    setPluginList: (state, payload) =>
      update(state, { pluginList: { $set: payload.plugins ?? {} } }),
    setPluginInfo: (state, payload) => update(state, { pluginInfo: { $set: payload.plugins } }),
    setPluginFilePath: (state, payload) => {
      const { pluginId, filePath } = payload;
      const withFilePath = <T extends { filePath: string }>(map: Record<string, T> = {}) => ({
        ...map,
        [pluginId]: { ...map[pluginId], filePath },
      });
      return update(state, {
        pluginList: { $set: withFilePath(state.pluginList) },
        pluginInfo: { $set: withFilePath(state.pluginInfo) },
      });
    },
    updatePluginWarnings: (state, payload) => {
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
    incrementNewPluginCounter: (state, payload) =>
      update(state, {
        newlyAddedPlugins: { $set: (state.newlyAddedPlugins ?? 0) + payload.counter },
      }),
    clearNewPluginCounter: (state) => update(state, { newlyAddedPlugins: { $set: 0 } }),
  },
);
