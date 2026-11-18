import { types, util } from "@nexusmods/vortex-api";

import * as actions from "./actions";
import type { IFNISSettings } from "./types";

/**
 * reducer for changes to ephemeral session state
 */
const settingsReducer: types.IReducerSpec<IFNISSettings> = {
  reducers: {
    [actions.setAutoRun as any]: (state: IFNISSettings, payload: boolean) =>
      util.setSafe(state, ["autoRun"], payload),
    [actions.setPatches as any]: (
      state: IFNISSettings,
      payload: { profileId: string; patches: string[] },
    ) => util.setSafe(state, ["patches", payload.profileId], payload.patches),
    [actions.setNeedToRun as any]: (
      state: IFNISSettings,
      payload: { profileId: string; force: boolean },
    ) => util.setSafe(state, ["needToRun", payload.profileId], payload.force),
  },
  defaults: {
    autoRun: false,
    patches: {},
    needToRun: {},
  },
};

export default settingsReducer;
