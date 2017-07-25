import { types, util } from 'nmm-api';

import * as actions from '../actions/session';

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.selectImportFolder as any]: (state, payload) => {
      const importFolder = payload;
      util.setSafe(state, ['selectFolder'], importFolder);
    },
  },
  defaults: {
    importedMods: {},
    selectFolder: false,
    selectedProfile: undefined,
  },
};
