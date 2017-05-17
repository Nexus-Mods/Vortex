import { IReducerSpec } from '../../../types/IExtensionContext';

import { setUserInfo } from '../actions/session';

import update = require('react-addons-update');

/**
 * reducer for changes to the authentication
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [setUserInfo as any]: (state, payload) => update(state, { userInfo: { $set: payload } }),
  },
  defaults: {
    userInfo: undefined,
  },
};
