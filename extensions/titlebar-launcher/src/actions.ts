import { createAction } from "redux-act";

export const setAddToTitleBar = createAction(
  "SET_ADD_TO_TITLEBAR",
  (addToTitleBar: boolean) => ({ addToTitleBar }),
);
