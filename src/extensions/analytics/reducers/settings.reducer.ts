import { IReducerSpec } from '../../../types/IExtensionContext';

import { setAnalytics } from './analytics.action';

import update from 'immutability-helper';

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [setAnalytics as any]: (state, payload) => update(state, { enabled: { $set: payload } }),
  },
  defaults: {
    enabled: undefined, // TODO, set me to false
  },
};

export default settingsReducer;
