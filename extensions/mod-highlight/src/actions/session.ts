import { createAction } from "redux-act";
import { types } from "vortex-api";

export const setDisplayBatchHighlight = createAction(
  "SET_DISPLAY_BATCH_HIGHLIGHTER",
  (display: boolean) => display,
);

export const setSelectedMods = createAction(
  "SET_HIGHLIGHTER_SELECTED_MODS",
  (selectedMods: string[]) => selectedMods,
);
