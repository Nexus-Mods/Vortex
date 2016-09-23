import { setKnownGames } from '../actions/session';
import { IReducerSpec } from '../types/IExtensionContext';
import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [setKnownGames]: (state, payload) => update(state, { knownGames: { $set: payload } }),
  },
  defaults: {
    knownGames: [],
  },
};
