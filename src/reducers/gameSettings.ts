import { setCurrentProfile } from '../actions/gameSettings';
import { createReducer } from 'redux-act';
import update = require('react-addons-update');

/**
 * reducer for changes to game-specific state
 */
export const gameSettingsReducer = createReducer({
  [setCurrentProfile]: (state, payload) => update(state, { currentProfile: { $set: payload } }),
}, {
  currentProfile: undefined,
});

