import { types, util } from 'nmm-api';

import * as actions from '../actions/session';

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setMods as any]: (state, payload) =>
      util.setSafe(state, ['importedMods'], payload),
    [actions.selectImportFolder as any]: (state, payload) =>
      util.setSafe(state, ['selectFolder'], payload),
  },
  defaults: {
    importedMods: {},
    selectFolder: false,
    selectedProfile: undefined,
  },
};
