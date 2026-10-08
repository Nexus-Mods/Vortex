import { createAction } from "redux-act";

/** A dev-only switch for work in progress, set from the dev tools menu. */
export type DevSetting = "newTable";

export const setDevSetting = createAction(
  "SET_DEV_SETTING",
  (name: DevSetting, value: boolean) => ({ name, value }),
);
