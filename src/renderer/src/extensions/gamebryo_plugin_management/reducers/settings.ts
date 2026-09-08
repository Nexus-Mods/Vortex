import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe } from "../../../util/storeHelper";
import * as actions from "../actions/settings";

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setAutoSortEnabled as any]: (state, payload) => setSafe(state, ["autoSort"], payload),
    [actions.setAutoEnable as any]: (state, payload) => setSafe(state, ["autoEnable"], payload),
    [actions.setPluginManagementEnabled as any]: (state, payload) => {
      const { profileId, enabled } = payload;
      return setSafe(state, ["pluginManagementEnabled", profileId], enabled);
    },
  },
  defaults: {
    autoSort: true,
    autoEnable: false,
  },
};
