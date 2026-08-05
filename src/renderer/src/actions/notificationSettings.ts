import { createAction } from "redux-act";

/**
 * set (or unset) notifications to not show again
 */
export const suppressNotification = createAction(
  "SUPPRESS_NOTIFICATION",
  (id: string, suppress: boolean) => ({ id, suppress }),
);

export const resetSuppression = createAction("RESET_SUPPRESSION", () => null);
