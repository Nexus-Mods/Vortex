import { setKnownGames } from '../actions/session';
import { createReducer } from 'redux-act';
import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer = createReducer({
  [setKnownGames]: (state, payload) => update(state, { knownGames: { $set: payload } }),
}, {
  knownGames: [],
});
