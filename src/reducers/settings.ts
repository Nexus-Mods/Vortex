import { addDiscoveredGame, setGameMode } from '../actions/settings';
import { IReducerSpec } from '../types/IExtensionContext';
import update = require('react-addons-update');

/**
 * reducer for changes to the window state
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [setGameMode]: (state, payload) => {
      return update(state, { gameMode: { $set: payload } });
    },
    [addDiscoveredGame]: (state, payload) => {
      return update(state, {
        discoveredGames: {
          [payload.id]: { $set: payload.result },
        },
      });
    },
  },
  defaults: {
    gameMode: undefined,
    discoveredGames: {},
  },
};
