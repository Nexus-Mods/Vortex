import { actionsToReducerSpec } from "../../../reducers/builder";
import type { IHealthCheckResult } from "../../../types/IHealthCheck";
import * as actions from "../actions/session";

export interface IHealthCheckSessionState {
  /** Results keyed by check ID */
  results: { [checkId: string]: IHealthCheckResult };
  /** Check IDs that are currently running */
  runningChecks: string[];
  /** Timestamp of the last full health check run */
  lastFullRun?: number;
}

/**
 * Reducer for health check session state
 */
export const sessionReducer = actionsToReducerSpec<IHealthCheckSessionState, typeof actions>(
  {
    results: {},
    runningChecks: [],
    lastFullRun: 0,
  },
  actions,
  {
    setHealthCheckResult: (state, payload) => {
      const { checkId, result } = payload;
      return {
        ...state,
        results: { ...state.results, [checkId]: result },
        lastFullRun: Date.now(),
      };
    },
    clearHealthCheckResult: (state, payload) => {
      if (state.results === undefined || !Object.hasOwn(state.results, payload)) {
        return state;
      }
      const { [payload]: _, ...results } = state.results;
      return { ...state, results };
    },
    clearAllHealthCheckResults: (state) => ({ ...state, results: {} }),
    setHealthCheckRunning: (state, payload) => {
      const { checkId, running } = payload;
      const currentRunning = state.runningChecks || [];

      if (running && !currentRunning.includes(checkId)) {
        return { ...state, runningChecks: [...currentRunning, checkId] };
      } else if (!running && currentRunning.includes(checkId)) {
        return { ...state, runningChecks: currentRunning.filter((id) => id !== checkId) };
      }
      return state;
    },
  },
);
