import type { UpdaterSnapshot } from "@vortex/shared/ipc";
import * as reduxAct from "redux-act";

import safeCreateAction from "../../actions/safeCreateAction";

/**
 * changes the 'channel' from which to receive Vortex updates
 * currently either 'beta', 'stable' or 'none'
 */
export const setUpdateChannel = safeCreateAction("SET_UPDATE_CHANNEL", (channel) => channel);

/**
 * the latest updater snapshot the renderer has polled from main, kept in
 * session state so UI (the Settings page) reads it like any other state and
 * keeps it across navigation
 */
export const setUpdaterSnapshot = safeCreateAction(
  "SET_UPDATER_SNAPSHOT",
  (snapshot: UpdaterSnapshot) => snapshot,
);
