import { IReducerSpec } from '../../../types/IExtensionContext';

import * as actions from '../actions/account';

import update from 'immutability-helper';
import { setSafe } from '../../../util/storeHelper';

/**
 * reducer for changes to the authentication
 */
export const accountReducer: IReducerSpec = {
  reducers: {
    [actions.setUserAPIKey as any]: (state, payload) =>
      update(state, { APIKey: { $set: payload } }),
    [actions.clearOAuthCredentials as any]: (state, payload) => setSafe(state, ['OAuthCredentials'], undefined),
    [actions.setOAuthCredentials as any]: (state, payload) =>
      update(state, { OAuthCredentials: { $set: { ...payload, } } }),
    [actions.setForcedLogout as any]: (state, value) => setSafe(state, ['ForcedLogout'], value)
  },
  defaults: {
    APIKey: undefined,
    OAuthCredentials: undefined,
    ForcedLogout: false
  },
};
