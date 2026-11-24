import { createAction } from "redux-act";

import type { IBrowseModsView } from "../reducers/mods_views/modsViews";
import type { IModViewChange } from "../util/mod_views/modViews";

/** Opens a view of Browse's mods, a preset's or the user's own, by id. */
export const selectBrowseModsView = createAction(
  "SELECT_BROWSE_MODS_VIEW",
  (viewId: string) => viewId,
);

/** Adds a view of the user's own, with its name, sort and filters, and opens it. */
export const addBrowseModsView = createAction(
  "ADD_BROWSE_MODS_VIEW",
  (view: IBrowseModsView) => view,
);

/** Renames a view of the user's own. */
export const renameBrowseModsView = createAction(
  "RENAME_BROWSE_MODS_VIEW",
  (viewId: string, name: string) => ({ viewId, name }),
);

/**
 * Changes how a view sorts or filters the mods: saved into a view of the user's own, or kept as a
 * preset's changes until a restart.
 */
export const setBrowseModsViewSearch = createAction(
  "SET_BROWSE_MODS_VIEW_SEARCH",
  (viewId: string, change: IModViewChange) => ({ viewId, change }),
);

/** Puts a preset's sort and filters back as they come. */
export const resetBrowseModsView = createAction(
  "RESET_BROWSE_MODS_VIEW",
  (viewId: string) => viewId,
);

/** Deletes a view of the user's own. */
export const removeBrowseModsView = createAction(
  "REMOVE_BROWSE_MODS_VIEW",
  (viewId: string) => viewId,
);
