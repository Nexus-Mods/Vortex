import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setExternalChangeAction, setExternalChanges } from '../actions/externalChanges';

/**
 * reducer for changes to settings regarding mods
 */
export const externalChangesReducer: IReducerSpec = {
  reducers: {
    [setExternalChanges as any]: (state, payload) =>
      setSafe(state, ['changes'], payload),
    [setExternalChangeAction as any]: (state, payload) => {
      const changeSet = new Set(payload.filePaths);
      let current = state;
      // TODO: This seems quite inefficient
      state.changes.forEach((entry, idx) => {
        if (changeSet.has(entry.filePath)) {
          current = setSafe(current, ['changes', idx, 'action'], payload.action);
        }
      });
      return current;
    },
  }, defaults: {
    changes: [],
  },
};
