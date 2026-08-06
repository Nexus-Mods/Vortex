import { actionsToReducerSpec } from "@/reducers/builder";

import { setAssociatedWithNXMURLs } from "../actions/settings";

type SettingsState = {
  associateNXM: boolean | undefined;
};

declare module "@/types/IState" {
  interface ISettings {
    nexus: SettingsState;
  }
}

const defaultState: SettingsState = {
  associateNXM: undefined,
};

export const settingsReducer = actionsToReducerSpec(
  defaultState,
  { setAssociatedWithNXMURLs },
  {
    setAssociatedWithNXMURLs: (state, payload) => ({ ...state, associateNXM: payload }),
  },
);
