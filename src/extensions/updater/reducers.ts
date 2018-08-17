import { IReducerSpec } from '../../types/IExtensionContext';

import { setUpdateChannel } from './actions';

import update from 'immutability-helper';

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [setUpdateChannel as any]: (state, payload) => update(state, { channel: { $set: payload } }),
  },
  defaults: {
    channel: 'stable',
  },
};

export default settingsReducer;
