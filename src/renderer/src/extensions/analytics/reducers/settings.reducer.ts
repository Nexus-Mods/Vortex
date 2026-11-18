import { actionsToReducerSpec } from "@/reducers/builder";

import * as actions from "../actions/analytics.action";

/** settings.analytics: whether the user agreed to send analytics */
export interface ISettingsAnalytics {
  // undefined until the user has answered
  enabled: boolean;
}

declare module "@/types/IState" {
  interface ISettings {
    analytics: ISettingsAnalytics;
  }
}

/**
 * reducer for changes to analytics settings
 */
const settingsReducer = actionsToReducerSpec<ISettingsAnalytics, typeof actions>(
  {
    enabled: undefined, // TODO, set me to false
  },
  actions,
  {
    setAnalytics: (state, payload) => ({ ...state, enabled: payload }),
  },
);

export default settingsReducer;
