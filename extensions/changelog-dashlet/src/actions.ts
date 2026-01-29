import { createAction } from "redux-act";

export const setChangelogs = createAction(
  "SET_CHANGELOGS",
  (changelogs: any[]) => changelogs,
);
