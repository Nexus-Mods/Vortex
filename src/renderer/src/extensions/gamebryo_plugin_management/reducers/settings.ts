import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/settings";

/** settings.plugins: the user's plugin management settings */
export interface ISettingsPlugins {
  autoSort: boolean;
  autoEnable: boolean;
  // keyed by profile id; absent until a profile's plugin management is first toggled
  pluginManagementEnabled?: { [profileId: string]: boolean };
}

declare module "@/types/IState" {
  interface ISettings {
    plugins: ISettingsPlugins;
  }
}

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer = actionsToReducerSpec<ISettingsPlugins, typeof actions>(
  {
    autoSort: true,
    autoEnable: false,
  },
  actions,
  {
    setAutoSortEnabled: (state, payload) => ({ ...state, autoSort: payload }),
    setAutoEnable: (state, payload) => ({ ...state, autoEnable: payload }),
    setPluginManagementEnabled: (state, payload) => {
      const { profileId, enabled } = payload;
      return {
        ...state,
        pluginManagementEnabled: { ...state.pluginManagementEnabled, [profileId]: enabled },
      };
    },
  },
);
