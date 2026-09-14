import type { Dispatch } from "redux";

import { startActivity, stopActivity } from "../actions/session";

/** Track a running promise as a session activity, stopped however the promise settles. */
export function withActivityTracking<T>(
  dispatch: Dispatch,
  activityType: string,
  activityId: string,
  promise: PromiseLike<T>,
): Promise<T> {
  dispatch(startActivity(activityType, activityId));
  return Promise.resolve(promise).finally(() => {
    dispatch(stopActivity(activityType, activityId));
  });
}
