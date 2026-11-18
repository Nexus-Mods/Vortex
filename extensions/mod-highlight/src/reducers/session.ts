import { types, util } from "@nexusmods/vortex-api";

import * as actions from "../actions/session";
import type { IModHighlightSessionState } from "../types/state";

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec<IModHighlightSessionState> = {
  reducers: {
    [actions.setDisplayBatchHighlight as any]: (
      state: IModHighlightSessionState,
      display: boolean,
    ) => {
      return util.setSafe(state, ["displayBatchHighlighter"], display);
    },
    [actions.setSelectedMods as any]: (
      state: IModHighlightSessionState,
      selectedMods: string[],
    ) => {
      return util.setSafe(state, ["selectedMods"], selectedMods);
    },
  },
  defaults: {
    selectedMods: [],
    displayBatchHighlighter: false,
  },
};
