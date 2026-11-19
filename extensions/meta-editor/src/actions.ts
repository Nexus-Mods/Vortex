import { createAction } from "redux-act";

export const setShowMetaEditor = createAction<string | undefined, {}>("SET_SHOW_METAEDITOR");
