import { IReducerSpec } from '../../../types/IExtensionContext';

import * as actions from '../actions/session';

import update from 'immutability-helper';
import { setSafe } from '../../../util/storeHelper';

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.setKnownGames as any]: (state, payload) => update(state, { known: { $set: payload } }),
    [actions.setGameDisabled as any]: (state, payload) =>
      setSafe(state, [ 'disabled', payload.gameId ], payload.disabledBy),
    [actions.clearGameDisabled as any]: (state, payload) =>
      update(state, { disabled: { $set: {} } }),
  },
  defaults: {
    known: [],
    disabled: {},
  },
};
