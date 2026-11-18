import { types, util } from "@nexusmods/vortex-api";

import * as actions from "./actions";

declare module "@nexusmods/vortex-api" {
  namespace types {
    /** The field of `settings.interface` this extension owns; core owns the rest. */
    interface ISettingsInterface {
      /** name of the selected theme */
      currentTheme: string;
    }
  }
}

const settingsReducer: types.IPartialReducerSpec<types.ISettingsInterface> = {
  reducers: {
    [actions.selectTheme as any]: (state: types.ISettingsInterface, payload: string) =>
      util.setSafe(state, ["currentTheme"], payload),
  },
  defaults: {
    currentTheme: "default",
  },
};

export default settingsReducer;
