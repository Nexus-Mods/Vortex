import { createAction } from "redux-act";

export const startEditCollection = createAction(
  "START_EDIT_COLLECTION",
  (modId: string) => ({ modId }),
);

export const startAddModsToCollection = createAction(
  "START_ADD_MODS_TO_COLLECTION",
  (collectionId: string) => ({ collectionId }),
);

export const healthDownvoteDialog = createAction(
  "HEALTH_DOWNVOTE_DIALOG",
  (collectionModId: string) => ({ collectionModId }),
);
