import * as actions from '../actions/loadOrder';

import {types, util} from 'vortex-api';

/**
 * reducer for changes to the plugin list
 */
export const loadOrderReducer: types.IReducerSpec = {
  reducers: {
    [actions.setPluginEnabled as any]: (state, payload) => {
      return (state[payload.pluginName] !== undefined)
        ? util.setSafe(state, [payload.pluginName.toLowerCase(), 'enabled'], payload.enabled)
        : util.merge(state, [payload.pluginName.toLowerCase()], {
          name: payload.pluginName,
          enabled: payload.enabled,
          loadOrder: -1,
        });
    },
    [actions.setPluginOrder as any]: (state, payload) => {
      const { plugins, defaultEnable } = payload;
      const result = {};
      plugins.forEach((pluginName: string, idx: number) => {
        result[pluginName.toLowerCase()] = {
          name: pluginName,
          enabled: util.getSafe(state, [pluginName, 'enabled'], defaultEnable),
          loadOrder: idx,
        };
      });
      return result;
    },
    [actions.updatePluginOrder as any]: (state, payload) => {
      const { pluginList, setEnabled, defaultEnable } = payload;

      const result = JSON.parse(JSON.stringify(state));

      // put the listed plugins in the specified order
      pluginList.forEach((pluginName: string, idx: number) => {
        const id = pluginName.toLowerCase();
        result[id] = {
          name: pluginName,
          enabled: setEnabled ? true : util.getSafe(state, [id, 'enabled'], defaultEnable),
          loadOrder: idx,
        };
      });

      const pluginListIds = pluginList.map(iter => iter.toLowerCase());

      // now deal with the rest, appending them to the list
      let nextLO = pluginList.length;
      Object.keys(result)
        .filter(key => pluginListIds.indexOf(key) === -1)
        .forEach(key => {
          result[key].loadOrder = nextLO++;
          if (setEnabled) {
            result[key].enabled = false;
          }
        });

      return result;
    },
  },
  defaults: {},
};
