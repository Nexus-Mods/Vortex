import * as reduxAct from "redux-act";

import safeCreateAction from "../../../actions/safeCreateAction";

export const setDeploymentNecessary = safeCreateAction(
  "SET_NEED_DEPLOYMENT",
  (gameId: string, required: boolean) => ({ gameId, required }),
);

/** Marks a game's mods as purged, until the next deployment puts them back. */
export const setDeploymentPurged = safeCreateAction(
  "SET_DEPLOYMENT_PURGED",
  (gameId: string, purged: boolean) => ({ gameId, purged }),
);
