import { IReducerSpec } from '../../../types/IExtensionContext';

import { setUserAPIKey } from '../actions/account';

import update from 'immutability-helper';

/**
 * reducer for changes to the authentication
 */
export const accountReducer: IReducerSpec = {
  reducers: {
    [setUserAPIKey as any]: (state, payload) =>
      update(state, { APIKey: { $set: payload } }),
  },
  defaults: {
    APIKey: undefined,
  },
};
