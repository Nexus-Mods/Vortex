import { IReducerSpec } from '../../../types/IExtensionContext';

import * as actions from '../actions/persistent';

import update from 'immutability-helper';

/**
 * reducer for changes to the authentication
 */
export const persistentReducer: IReducerSpec = {
  reducers: {
    [actions.setUserInfo as any]: (state, payload) =>
      update(state, { userInfo: { $set: payload } }),
    [actions.setNewestVersion as any]: (state, payload) =>
      update(state, { newestVersion: { $set: payload } }),
  },
  defaults: {
    userInfo: undefined,
    newestVersion: undefined,
  },
  verifiers: {
    userInfo: {
      type: 'object',
      noNull: true,
    },
  },
};
