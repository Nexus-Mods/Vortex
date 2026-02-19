import type { IReducerSpec } from "../../../renderer/types/IExtensionContext";
import type { IHealthCheckResult } from "../../../renderer/types/IHealthCheck";
import { deleteOrNop, setSafe } from "../../../renderer/util/storeHelper";
import type { IModFileInfo } from "../types";

import * as actions from "../actions/session";

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

/**
 * Reducer for health check session state
 */
export const sessionReducer: IReducerSpec<IHealthCheckSessionState> = {
  reducers: {
    [actions.setHealthCheckResult as any]: (state, payload) => {
      const { checkId, result } = payload;
      const timestamp = Date.now();
      const newState = setSafe(state, ["results", checkId], result);
      return setSafe(newState, ["lastFullRun"], timestamp);
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
    [actions.setModFiles as any]: (state, payload) => {
      const { modId, files } = payload;
      return setSafe(state, ["modFiles", modId], files);
    },
    [actions.setModFilesLoading as any]: (state, payload) => {
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
    },
  },
  defaults: {
    results: {},
    runningChecks: [],
    lastFullRun: 0,
    modFiles: {},
    loadingModFiles: [],
  },
};
