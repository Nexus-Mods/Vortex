import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/session';

import * as update from 'immutability-helper';

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.setKnownGames as any]: (state, payload) => update(state, { known: { $set: payload } }),
  },
  defaults: {
    known: [],
  },
};
