import { createAction } from "redux-act";

import type { ITableSort } from "@/ui/components/table/Table.types";

import type { IModsTableViewChanges } from "../reducers/modsTableViews";
import type { IModsTableFilters } from "../util/mods_table_filters/modsTableFilters";

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

/** Sorts a view by a column, one way or the other. */
export const setModsTableViewSort = createAction(
  "SET_MODS_TABLE_VIEW_SORT",
  (viewId: string, sort: ITableSort) => ({ viewId, sort }),
);

/** Changes some of a view's filters. */
export const setModsTableViewFilters = createAction(
  "SET_MODS_TABLE_VIEW_FILTERS",
  (viewId: string, filters: Partial<IModsTableFilters>) => ({ viewId, filters }),
);

/** Puts a view's filters back to its defaults: the given ones, or all of them for `undefined`. */
export const resetModsTableViewFilters = createAction(
  "RESET_MODS_TABLE_VIEW_FILTERS",
  (viewId: string, keys: Array<keyof IModsTableFilters> | undefined) => ({ viewId, keys }),
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

/** Puts a view's grouping back to its default, keeping its sort, columns, widths and filters. */
export const resetModsTableView = createAction("RESET_MODS_TABLE_VIEW", (viewId: string) => viewId);

/** Adds a view of the user's own, by id and name, starting with `changes`, and opens it. */
export const addModsTableView = createAction(
  "ADD_MODS_TABLE_VIEW",
  (viewId: string, name: string, changes: IModsTableViewChanges) => ({ viewId, name, changes }),
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
