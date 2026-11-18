import { types, util } from "@nexusmods/vortex-api";

import * as actions from "./actions";

// Writes `settings.interface.tools.addToolsToTitleBar`, which core's ISettingsInterface already
// declares, so there is no state to augment and no defaults to add.
const reducer = util.actionsToPartialReducerSpec<types.ISettingsInterface, typeof actions>(
  {},
  actions,
  {
    setAddToTitleBar: (state, payload) => {
      const { addToTitleBar } = payload;
      return util.setSafe(state, ["tools", "addToolsToTitleBar"], addToTitleBar);
    },
  },
);

export default reducer;
