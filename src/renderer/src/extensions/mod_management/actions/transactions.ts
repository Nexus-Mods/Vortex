import { createAction } from "redux-act";

import safeCreateAction from "../../../actions/safeCreateAction";

/**
 * Used to track transfer attempts and correctly recover if it gets interrupted.
 */
export const setTransferMods = safeCreateAction(
  "SET_TRANSFER_MODS",
  (gameId: string, destination: string) => ({ gameId, destination }),
);

// TODO: move these pending-plugin-sort actions (and their reducer cases in reducers/transactions)
// to gamebryo-plugin-management once/if that extension is merged into core. They live here for now
// because the action creators must be in core for the collections install flow to dispatch them
// type-safely, while gamebryo (a bundled extension) only reads/clears them via the api.
/**
 * Durable "this profile still needs its plugins sorted/enabled" marker, keyed by the profile a
 * collection was installed against (load order and plugin-enable state are per-profile). Set when a
 * collection install begins and cleared only once a plugin sort actually succeeds, so an install
 * interrupted by a crash/quit is recovered on the next activation of the profile (deploy then sort).
 * Lives in the cross-extension transactions slice because it is written by the collections install
 * flow but read/cleared by gamebryo plugin management. The value is the epoch-ms time it was queued.
 */
export const setPendingPluginSort = createAction(
  "SET_PENDING_PLUGIN_SORT",
  (profileId: string, collectionId: string, time: number) => ({ profileId, collectionId, time }),
);

/**
 * Clears every pending plugin-sort marker for a profile; a single successful sort orders all of the
 * profile's plugins, so it satisfies all collections queued for that profile at once.
 */
export const clearPendingPluginSort = createAction(
  "CLEAR_PENDING_PLUGIN_SORT",
  (profileId: string) => ({ profileId }),
);
