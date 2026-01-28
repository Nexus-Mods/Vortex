import { createAction } from "redux-act";

export const setShowMetaEditor = createAction<string, {}>(
  "SET_SHOW_METAEDITOR",
);
