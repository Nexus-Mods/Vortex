import { createAction } from "redux-act";

export const setMultiUser = createAction("SET_MUTLI_USER", (enabled: boolean) => enabled);
