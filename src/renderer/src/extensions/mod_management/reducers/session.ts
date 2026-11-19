import type { VortexModId } from "@vortex/shared";

import { actionsToReducerSpec } from "../../../reducers/builder";
import type { IDeploymentFailure, IDeploymentProblem } from "../actions/session";
import {
  addDeploymentFailures,
  focusModsTableGroup,
  focusModsTableMod,
  setDeploymentFailures,
  setDeploymentProblem,
  setExternalChangeAction,
  setExternalChanges,
  setUpdatingMods,
} from "../actions/session";
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
  /** a group the new Mods table is to open and scroll to, until it has */
  focusedGroupId?: string;
  /** a mod the new Mods table is to scroll to and select, until it has */
  focusedModId?: VortexModId;
}

declare module "@/types/IState" {
  interface ISessionState {
    mods: IModsSessionState;
  }
}

const sessionActions = {
  focusModsTableGroup,
  focusModsTableMod,
  setExternalChanges,
  setExternalChangeAction,
  setUpdatingMods,
  setDeploymentProblem,
  setDeploymentFailures,
  addDeploymentFailures,
};

/**
 * reducer for changes to settings regarding mods
 */
export const sessionReducer = actionsToReducerSpec<IModsSessionState, typeof sessionActions>(
  {
    changes: [],
    updatingMods: {},
    deploymentProblems: [],
    deploymentFailures: {},
  },
  sessionActions,
  {
    focusModsTableGroup: (state, payload) => ({ ...state, focusedGroupId: payload }),
    focusModsTableMod: (state, payload) => ({ ...state, focusedModId: payload }),
    setExternalChanges: (state, payload) => ({ ...state, changes: payload }),
    setExternalChangeAction: (state, payload) => {
      const changeSet = new Set(payload.filePaths);
      const chosen = (entry: IFileEntry) =>
        changeSet.has(entry.filePath) &&
        (payload.source === undefined || entry.source === payload.source);
      return {
        ...state,
        changes: state.changes.map((entry) =>
          chosen(entry) ? { ...entry, action: payload.action } : entry,
        ),
      };
    },
    setUpdatingMods: (state, payload) => ({
      ...state,
      updatingMods: { ...state.updatingMods, [payload.gameId]: payload.updatingMods },
    }),
    setDeploymentProblem: (state, payload) => ({ ...state, deploymentProblems: payload }),
    setDeploymentFailures: (state, payload) => ({
      ...state,
      deploymentFailures: {
        ...state.deploymentFailures,
        [payload.gameId]: payload.failures,
      },
    }),
    addDeploymentFailures: (state, payload) => ({
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
);
