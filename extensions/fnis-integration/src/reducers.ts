import { util } from "@nexusmods/vortex-api";

import * as actions from "./actions";
import type { IFNISSettings } from "./types";

/**
 * reducer for changes to ephemeral session state
 */
const settingsReducer = util.actionsToReducerSpec<IFNISSettings, typeof actions>(
  {
    autoRun: false,
    patches: {},
    needToRun: {},
  },
  actions,
  {
    setAutoRun: (state, payload) => util.setSafe(state, ["autoRun"], payload),
    setPatches: (state, payload) =>
      util.setSafe(state, ["patches", payload.profileId], payload.patches),
    setNeedToRun: (state, payload) =>
      util.setSafe(state, ["needToRun", payload.profileId], payload.force),
  },
);

export default settingsReducer;
