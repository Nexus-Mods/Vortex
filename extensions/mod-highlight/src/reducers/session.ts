import { types, util } from "vortex-api";

import * as actions from "../actions/session";

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setDisplayBatchHighlight as any]: (state, display) => {
      return util.setSafe(state, ["displayBatchHighlighter"], display);
    },
    [actions.setSelectedMods as any]: (state, selectedMods) => {
      return util.setSafe(state, ["selectedMods"], selectedMods);
    },
  },
  defaults: {
    selectedMods: [],
    displayBatchHighlighter: false,
  },
};
