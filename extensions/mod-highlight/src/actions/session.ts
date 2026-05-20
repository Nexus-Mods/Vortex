import { types } from "@nexusmods/vortex-api";
import { createAction } from "redux-act";

export const setDisplayBatchHighlight = createAction(
  "SET_DISPLAY_BATCH_HIGHLIGHTER",
  (display: boolean) => display,
);

export const setSelectedMods = createAction(
  "SET_HIGHLIGHTER_SELECTED_MODS",
  (selectedMods: string[]) => selectedMods,
);
