import { IReducerSpec } from '../../../types/IExtensionContext';

import { setLogSessions } from '../actions/session';

import * as update from 'immutability-helper';

/**
 * reducer for changes to the Vortex logs
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [setLogSessions as any]: (state, payload) => update(state, { logSessions: { $set: payload } }),
  },
  defaults: {
    logSessions: [],
  },
};
