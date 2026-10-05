import { createAction } from "redux-act";

export const setSuppressModLimitPatch = createAction(
  "TW3_SET_SUPPRESS_LIMIT_PATCH",
  (suppress) => suppress,
);

export const setRemasterNoticeSeen = createAction("TW3_SET_REMASTER_NOTICE_SEEN", (seen) => seen);

export const autoSortLoadOrderChanged = createAction(
  "TW3_AUTO_SORT_LOAD_ORDER_CHANGED",
  (enabled: boolean) => enabled,
);
