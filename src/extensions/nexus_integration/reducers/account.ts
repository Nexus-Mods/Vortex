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
  },
  defaults: {
    APIKey: undefined,
    OAuthCredentials: undefined,
  },
};
