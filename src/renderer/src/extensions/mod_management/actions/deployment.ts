import { createAction } from "redux-act";

export const setDeploymentNecessary = createAction(
  "SET_NEED_DEPLOYMENT",
  (gameId: string, required: boolean) => ({ gameId, required }),
);

/** Marks a game's mods as purged, until the next deployment puts them back. */
export const setDeploymentPurged = createAction(
  "SET_DEPLOYMENT_PURGED",
  (gameId: string, purged: boolean) => ({ gameId, purged }),
);
