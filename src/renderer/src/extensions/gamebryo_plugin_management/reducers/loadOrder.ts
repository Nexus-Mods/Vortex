import update from "immutability-helper";

import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/loadOrder";
import type { IPluginLoadOrderEntry } from "../types/IPluginLoadOrderEntry";
import toPluginId from "../util/toPluginId";

/** the plugin load order, keyed by plugin id (lowercased, ghost suffix stripped) */
export type IPluginLoadOrder = Record<string, IPluginLoadOrderEntry>;

declare module "@/types/IState" {
  interface IState {
    loadOrder: IPluginLoadOrder;
  }
}

/**
 * reducer for changes to the plugin list. entries are keyed by plugin id (lowercased, ghost suffix
 * stripped) via toPluginId, so the key never diverges from the rest of the extension.
 */
export const loadOrderReducer = actionsToReducerSpec<IPluginLoadOrder, typeof actions>(
  {},
  actions,
  {
    setPluginEnabled: (state, payload) => {
      const id = toPluginId(payload.pluginName);
      return state[id] !== undefined
        ? update(state, { [id]: { enabled: { $set: payload.enabled } } })
        : update(state, {
            [id]: {
              $set: { name: payload.pluginName, enabled: payload.enabled, loadOrder: -1 },
            },
          });
    },
    setPluginOrder: (state, payload) => {
      const { plugins, defaultEnable } = payload;
      const result: IPluginLoadOrder = {};
      plugins.forEach((pluginName, idx) => {
        const id = toPluginId(pluginName);
        result[id] = {
          name: pluginName,
          enabled: state[id]?.enabled ?? defaultEnable,
          loadOrder: idx,
        };
      });
      return result;
    },
    updatePluginOrder: (state, payload) => {
      const { pluginList, setEnabled, defaultEnable } = payload;

      const result: IPluginLoadOrder = JSON.parse(JSON.stringify(state));

      // put the listed plugins in the specified order
      pluginList.forEach((pluginName, idx) => {
        const id = toPluginId(pluginName);
        result[id] = {
          name: pluginName,
          enabled: setEnabled ? true : (state[id]?.enabled ?? defaultEnable),
          loadOrder: idx,
        };
      });

      const pluginListIds = pluginList.map((iter) => toPluginId(iter));

      // now deal with the rest, appending them to the list
      let nextLO = pluginList.length;
      Object.keys(result)
        .filter((key) => pluginListIds.indexOf(key) === -1)
        .forEach((key) => {
          result[key].loadOrder = nextLO++;
          if (setEnabled) {
            result[key].enabled = false;
          }
        });

      return result;
    },
  },
);
