import { createAction } from "redux-act";

export const selectTheme = createAction<string, {}>("SELECT_UI_THEME");
