import { types, util } from "@nexusmods/vortex-api";

import * as actions from "./actions";

// Writes `settings.interface.tools.addToolsToTitleBar`, which core's ISettingsInterface already
// declares, so there is no state to augment and no defaults to add.
const reducer: types.IPartialReducerSpec<types.ISettingsInterface> = {
  reducers: {
    [actions.setAddToTitleBar as any]: (
      state: types.ISettingsInterface,
      payload: { addToTitleBar: boolean },
    ) => {
      const { addToTitleBar } = payload;
      return util.setSafe(state, ["tools", "addToolsToTitleBar"], addToTitleBar);
    },
  },
  defaults: {},
};

export default reducer;
