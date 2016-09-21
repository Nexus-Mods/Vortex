import { setLoggedInUser } from '../actions/account';
import { createReducer } from 'redux-act';
import update = require('react-addons-update');

/**
 * reducer for changes to the authentication
 */
export const accountReducer = createReducer({
  [setLoggedInUser]: (state, payload) => update(state, { account: { $set: payload } }),
}, {
  account: { username: 'undefined', cookie: '' },
});
