import { types, util } from "@nexusmods/vortex-api";
import update from "immutability-helper";

import * as actions from "../actions/settings";
import type { ISettingsSavegame } from "../types/IStateSavegame";

/**
 * reducer for changes to ephemeral session state
 */
export const settingsReducer: types.IReducerSpec<ISettingsSavegame> = {
  reducers: {
    [actions.enableMonitor as any]: (state: ISettingsSavegame, payload: boolean) => {
      return util.setSafe(state, ["monitorEnabled"], payload);
    },
  },
  defaults: {
    monitorEnabled: true,
  },
};
