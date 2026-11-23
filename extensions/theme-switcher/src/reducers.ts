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

const settingsReducer = util.actionsToPartialReducerSpec<types.ISettingsInterface, typeof actions>(
  { currentTheme: "default" },
  actions,
  {
    selectTheme: (state, payload) => util.setSafe(state, ["currentTheme"], payload),
  },
);

export default settingsReducer;
