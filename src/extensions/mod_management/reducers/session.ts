import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/session';

/**
 * reducer for changes to settings regarding mods
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.setExternalChanges as any]: (state, payload) =>
      setSafe(state, ['changes'], payload),
    [actions.setExternalChangeAction as any]: (state, payload) => {
      const changeSet = new Set(payload.filePaths);
      let current = state;
      state.changes.forEach((entry, idx) => {
        if (changeSet.has(entry.filePath)) {
          current = setSafe(current, ['changes', idx, 'action'], payload.action);
        }
      });
      return current;
    },
    [actions.setUpdatingMods as any]: (state, payload) => {
      const { gameId, updatingMods } = payload;
      return setSafe(state, ['updatingMods', gameId], updatingMods);
    },
    [actions.setDeploymentProblem as any]: (state, payload) =>
      setSafe(state, ['deploymentProblems'], payload),
    [actions.setPurgeSummary as any]: (state, payload) =>
      setSafe(state, ['purgeSummary'], payload),
    [actions.setPurgeSummaryVisible as any]: (state, payload) =>
      setSafe(state, ['purgeSummaryVisible'], payload),
    [actions.clearPurgeSummary as any]: (state) =>
      setSafe(state, ['purgeSummary'], undefined),
  },
  defaults: {
    changes: [],
    updatingMods: {},
    deploymentProblems: [],
    purgeSummary: undefined,
    purgeSummaryVisible: false,
  },
};
