import { IReducerSpec } from '../../../types/IExtensionContext';

import { setUpdateAnalytics } from './updateAnalytics.action';

import update from 'immutability-helper';

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [setUpdateAnalytics as any]: (state, payload) => update(state, { enabled: { $set: payload } }),
  },
  defaults: {
    enabled: true, // TODO, set me to false
  },
};

export default settingsReducer;
