import { util } from "@nexusmods/vortex-api";

import * as actions from "../actions/session";
import type { IModHighlightSessionState } from "../types/state";

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer = util.actionsToReducerSpec<IModHighlightSessionState, typeof actions>(
  {
    selectedMods: [],
    displayBatchHighlighter: false,
  },
  actions,
  {
    setDisplayBatchHighlight: (state, display) =>
      util.setSafe(state, ["displayBatchHighlighter"], display),
    setSelectedMods: (state, selectedMods) => util.setSafe(state, ["selectedMods"], selectedMods),
  },
);
