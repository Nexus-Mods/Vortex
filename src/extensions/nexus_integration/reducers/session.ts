import { IReducerSpec } from '../../../types/IExtensionContext';

import * as actions from '../actions/session';

import * as update from 'immutability-helper';

/**
 * reducer for changes to the authentication
 */
export const sessionReducer: IReducerSpec = {
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
