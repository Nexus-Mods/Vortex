import { IReducerSpec } from '../../../types/IExtensionContext';
import { setKnownGames } from '../actions/session';
import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [setKnownGames as any]: (state, payload) => update(state, { known: { $set: payload } }),
  },
  defaults: {
    known: null,
  },
};
