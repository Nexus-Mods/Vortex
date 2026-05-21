import { types, util } from "@nexusmods/vortex-api";

import * as actions from "./actions";

const settingsReducer: types.IReducerSpec = {
  reducers: {
    [actions.selectTheme as any]: (state, payload) =>
      util.setSafe(state, ["currentTheme"], payload),
  },
  defaults: {
    currentTheme: "default",
  },
};

export default settingsReducer;
