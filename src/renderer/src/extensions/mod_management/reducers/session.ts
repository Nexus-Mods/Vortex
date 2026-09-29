import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe } from "../../../util/storeHelper";
import type { IDeploymentFailure, IDeploymentProblem } from "../actions/session";
import * as actions from "../actions/session";
import { MAX_STORED_DEPLOYMENT_FAILURES } from "../constants";
import type { IFileEntry } from "../types/IFileEntry";

export interface IModsSessionState {
  /** files changed outside Vortex, awaiting the user's decision */
  changes: IFileEntry[];
  /** keyed by gameId */
  updatingMods: Record<string, boolean>;
  /** reasons no deployment method can serve the current setup */
  deploymentProblems: IDeploymentProblem[];
  /** keyed by gameId: files the last deployment of that game couldn't place */
  deploymentFailures: Record<string, IDeploymentFailure[]>;
}

declare module "@/types/IState" {
  interface ISessionState {
    mods: IModsSessionState;
  }
}

/**
 * reducer for changes to settings regarding mods
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.setExternalChanges as any]: (state, payload) => setSafe(state, ["changes"], payload),
    [actions.setExternalChangeAction as any]: (state, payload) => {
      const changeSet = new Set(payload.filePaths);
      let current = state;
      state.changes.forEach((entry, idx) => {
        if (changeSet.has(entry.filePath)) {
          current = setSafe(current, ["changes", idx, "action"], payload.action);
        }
      });
      return current;
    },
    [actions.setUpdatingMods as any]: (state, payload) => {
      const { gameId, updatingMods } = payload;
      return setSafe(state, ["updatingMods", gameId], updatingMods);
    },
    [actions.setDeploymentProblem as any]: (state, payload) =>
      setSafe(state, ["deploymentProblems"], payload),
    [actions.setDeploymentFailures as any]: (state, payload) => ({
      ...state,
      deploymentFailures: {
        ...state.deploymentFailures,
        [payload.gameId]: payload.failures,
      },
    }),
    [actions.addDeploymentFailures as any]: (state, payload) => ({
      ...state,
      deploymentFailures: {
        ...state.deploymentFailures,
        // a wholesale failure would otherwise put every file into the store
        [payload.gameId]: [
          ...(state.deploymentFailures?.[payload.gameId] ?? []),
          ...payload.failures,
        ].slice(0, MAX_STORED_DEPLOYMENT_FAILURES),
      },
    }),
  },
  defaults: {
    changes: [],
    updatingMods: {},
    deploymentProblems: [],
    deploymentFailures: {},
  },
};
