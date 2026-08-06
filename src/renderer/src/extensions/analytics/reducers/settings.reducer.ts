import { actionsToReducerSpec } from "@/reducers/builder";

import { setAnalytics } from "../actions/analytics.action";

type AnalyticsSettings = {
  enabled: boolean;
};

declare module "@/types/IState" {
  interface ISettings {
    analytics: AnalyticsSettings;
  }
}

const defaultState: AnalyticsSettings = {
  enabled: false,
};

export const settingsReducer = actionsToReducerSpec(
  defaultState,
  { setAnalytics },
  {
    setAnalytics: (state, payload) => ({ ...state, enabled: payload }),
  },
);
