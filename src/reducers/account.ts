import { loadUserInfo, setUserAPIKey } from '../actions/account';
import { IReducerSpec } from '../types/IExtensionContext';

import update = require('react-addons-update');

/**
 * reducer for changes to the authentication
 */
export const accountReducer: IReducerSpec = {
  reducers: {
    [setUserAPIKey]: (state, payload) => update(state, { account: { $set: payload } }),
    [loadUserInfo]: (state, payload) => update(state, { account: { $set: payload } }),
  },
  defaults: {
    account: { APIKey: '' },
  },
};
