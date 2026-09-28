import { createAction } from "redux-act";

export const setPriorityType = createAction("TW3_SET_PRIORITY_TYPE", (type) => type);

export const setSuppressModLimitPatch = createAction(
  "TW3_SET_SUPPRESS_LIMIT_PATCH",
  (suppress) => suppress,
);

export const setRemasterNoticeSeen = createAction("TW3_SET_REMASTER_NOTICE_SEEN", (seen) => seen);
