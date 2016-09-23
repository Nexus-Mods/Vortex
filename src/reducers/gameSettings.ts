import { IReducerSpec } from '../types/IExtensionContext';

import { setCurrentProfile } from '../actions/gameSettings';
import update = require('react-addons-update');

/**
 * reducer for changes to game-specific state
 */
export const gameSettingsReducer: IReducerSpec = {
  reducers: {
    [setCurrentProfile]: (state, payload) => update(state, { currentProfile: { $set: payload } }),
  },
  defaults: {
    currentProfile: undefined,
  }
};

