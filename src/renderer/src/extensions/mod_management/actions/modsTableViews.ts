import { createAction } from "redux-act";

/** Opens a view of the new Mods table, by id. */
export const selectModsTableView = createAction(
  "SELECT_MODS_TABLE_VIEW",
  (viewId: string) => viewId,
);

/** Groups a view by a column's id, or "none". */
export const setModsTableViewGrouping = createAction(
  "SET_MODS_TABLE_VIEW_GROUPING",
  (viewId: string, grouping: string) => ({ viewId, grouping }),
);

/** Shows or hides a column in a view. */
export const setModsTableViewColumn = createAction(
  "SET_MODS_TABLE_VIEW_COLUMN",
  (viewId: string, columnId: string, visible: boolean) => ({ viewId, columnId, visible }),
);

/** Keeps columns' resized widths in a view, in px by id, forgetting any that are `undefined`. */
export const setModsTableViewColumnWidths = createAction(
  "SET_MODS_TABLE_VIEW_COLUMN_WIDTHS",
  (viewId: string, widths: { [columnId: string]: number | undefined }) => ({ viewId, widths }),
);

/** Forgets what the user changed about a view, back to its defaults, but keeps its widths. */
export const resetModsTableView = createAction("RESET_MODS_TABLE_VIEW", (viewId: string) => viewId);

/** Adds a view of the user's own, by a new id and its name, and opens it. */
export const addModsTableView = createAction(
  "ADD_MODS_TABLE_VIEW",
  (viewId: string, name: string) => ({ viewId, name }),
);

/** Renames a view of the user's own. */
export const renameModsTableView = createAction(
  "RENAME_MODS_TABLE_VIEW",
  (viewId: string, name: string) => ({ viewId, name }),
);

/** Deletes a view of the user's own, with what was changed about it. */
export const removeModsTableView = createAction(
  "REMOVE_MODS_TABLE_VIEW",
  (viewId: string) => viewId,
);
