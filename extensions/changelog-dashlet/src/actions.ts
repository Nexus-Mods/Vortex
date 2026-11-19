import { createAction } from "redux-act";

import type { Changelog } from "./types";

export const setChangelogs = createAction(
  "SET_CHANGELOGS",
  (changelogs: Changelog[]) => changelogs,
);
