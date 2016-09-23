import { setUserAPIKey, loadUserInfo } from '../actions/account';
import { createReducer } from 'redux-act';
import update = require('react-addons-update');

/**
 * reducer for changes to the authentication
 */
export const accountReducer = createReducer({
    [setUserAPIKey]: (state, payload) => update(state, { account: { $set: payload } }),
    [loadUserInfo]: (state, payload) => update(state, { account: { $set: payload } }),
}, {
  account: { APIKey: '' },
});
