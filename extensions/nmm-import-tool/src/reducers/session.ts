import { types, util } from 'vortex-api';

import * as actions from '../actions/session';

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setImportStep as any]: (state, payload) =>
      util.setSafe(state, ['importStep'], payload),
    [actions.selectImportFolder as any]: (state, payload) => {
      const importFolder = payload;
      util.setSafe(state, ['selectFolder'], importFolder);
    },
  },
  defaults: {
    importStep: undefined,
    importedMods: {},
    selectFolder: false,
    selectedProfile: undefined,
  },
};
