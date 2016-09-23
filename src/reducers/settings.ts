import { addDiscoveredGame, setGameMode } from '../actions/settings';
import { createReducer } from 'redux-act';
import update = require('react-addons-update');

/**
 * reducer for changes to the window state
 */
export const settingsReducer = createReducer({
  [setGameMode]: (state, payload) => {
    return update(state, { gameMode: { $set: payload } });
  },
  [addDiscoveredGame]: (state, payload) => {
    return update(state, {
      discoveredGames: {
        [ payload.id ]: { $set: payload.result },
      },
    });
  },
}, {
  gameMode: undefined,
  discoveredGames: { },
});
