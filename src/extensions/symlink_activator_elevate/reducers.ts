import { IReducerSpec } from '../../types/IExtensionContext';

import * as actions from './actions';

import update from 'immutability-helper';

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.enableUserSymlinks as any]: (state, payload) =>
      update(state, { userSymlinks: { $set: payload } }),
  },
  defaults: {
    userSymlinks: false,
  },
};

export default settingsReducer;
