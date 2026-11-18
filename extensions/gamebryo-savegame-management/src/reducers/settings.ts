import { util } from "@nexusmods/vortex-api";

import * as actions from "../actions/settings";
import type { ISettingsSavegame } from "../types/IStateSavegame";

/**
 * reducer for changes to ephemeral session state
 */
export const settingsReducer = util.actionsToReducerSpec<ISettingsSavegame, typeof actions>(
  { monitorEnabled: true },
  actions,
  {
    enableMonitor: (state, payload) => util.setSafe(state, ["monitorEnabled"], payload),
  },
);
