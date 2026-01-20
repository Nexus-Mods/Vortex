import type { IReducerSpec } from "../../../types/IExtensionContext";
import type { IHealthCheckResult } from "../../../types/IHealthCheck";
import { deleteOrNop, setSafe } from "../../../util/storeHelper";

import * as actions from "../actions/session";

export interface IHealthCheckSessionState {
  /** Results keyed by check ID */
  results: { [checkId: string]: IHealthCheckResult };
  /** Check IDs that are currently running */
  runningChecks: string[];
}

/**
 * Reducer for health check session state
 */
export const sessionReducer: IReducerSpec<IHealthCheckSessionState> = {
  reducers: {
    [actions.setHealthCheckResult as any]: (state, payload) => {
      const { checkId, result } = payload;
      return setSafe(state, ["results", checkId], result);
    },
    [actions.clearHealthCheckResult as any]: (state, payload) => {
      return deleteOrNop(state, ["results", payload]);
    },
    [actions.clearAllHealthCheckResults as any]: (state) => {
      return setSafe(state, ["results"], {});
    },
    [actions.setHealthCheckRunning as any]: (state, payload) => {
      const { checkId, running } = payload;
      const currentRunning = state.runningChecks || [];

      if (running && !currentRunning.includes(checkId)) {
        return setSafe(state, ["runningChecks"], [...currentRunning, checkId]);
      } else if (!running && currentRunning.includes(checkId)) {
        return setSafe(
          state,
          ["runningChecks"],
          currentRunning.filter((id) => id !== checkId),
        );
      }
      return state;
    },
  },
  defaults: {
    results: {},
    runningChecks: [],
  },
};
