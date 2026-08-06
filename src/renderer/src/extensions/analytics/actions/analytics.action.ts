import { createAction } from "redux-act";

/**
 * changes the 'analytics' toggle, which is either on or off
 */
export const setAnalytics = createAction("SET_UPDATE_ANALYTICS", (analytics: boolean) => analytics);
