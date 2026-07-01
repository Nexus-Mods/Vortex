import type { IReducerSpec } from "../../../types/IExtensionContext";
import type { IHealthCheckResult } from "../../../types/IHealthCheck";
import { deleteOrNop, setSafe } from "../../../util/storeHelper";
import * as actions from "../actions/session";
import type { IModFileInfo } from "../types";
import { reducerFor } from "./reducerFor";

export interface IHealthCheckSessionState {
  /** Results keyed by check ID */
  results: { [checkId: string]: IHealthCheckResult };
  /** Check IDs that are currently running */
  runningChecks: string[];
  /** Timestamp of the last full health check run */
  lastFullRun?: number;
  /** Cached mod files keyed by mod ID */
  modFiles: Record<number, IModFileInfo[]>;
  /** Mod IDs currently being fetched */
  loadingModFiles: number[];
}

const on = reducerFor<IHealthCheckSessionState>();

/**
 * Reducer for health check session state
 */
export const sessionReducer: IReducerSpec<IHealthCheckSessionState> = {
  reducers: Object.fromEntries([
    on(actions.setHealthCheckResult, (state, payload) => {
      const { checkId, result } = payload;
      const timestamp = Date.now();
      const newState = setSafe(state, ["results", checkId], result);
      return setSafe(newState, ["lastFullRun"], timestamp);
    }),
    on(actions.clearHealthCheckResult, (state, payload) =>
      deleteOrNop(state, ["results", payload]),
    ),
    on(actions.clearAllHealthCheckResults, (state) => setSafe(state, ["results"], {})),
    on(actions.setHealthCheckRunning, (state, payload) => {
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
    }),
    on(actions.setModFiles, (state, payload) => {
      const { modId, files } = payload;
      return setSafe(state, ["modFiles", modId], files);
    }),
    on(actions.setModFilesLoading, (state, payload) => {
      const { modId, loading } = payload;
      const currentLoading = state.loadingModFiles || [];

      if (loading && !currentLoading.includes(modId)) {
        return setSafe(state, ["loadingModFiles"], [...currentLoading, modId]);
      } else if (!loading && currentLoading.includes(modId)) {
        return setSafe(
          state,
          ["loadingModFiles"],
          currentLoading.filter((id) => id !== modId),
        );
      }
      return state;
    }),
  ]),
  defaults: {
    results: {},
    runningChecks: [],
    lastFullRun: 0,
    modFiles: {},
    loadingModFiles: [],
  },
};
