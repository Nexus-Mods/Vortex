import { IReducerSpec } from '../../../types/IExtensionContext';

import { discoveryFinished, discoveryProgress } from '../actions/discovery';

import update = require('react-addons-update');

/**
 * reducer for changes to the known mods
 */
export const discoveryReducer: IReducerSpec = {
  reducers: {
    [discoveryProgress as any]: (state, payload) => update(state, {
      running: { $set: true },
      progress: { $set: payload.percent },
      directory: { $set: payload.directory },
    }),
    [discoveryFinished as any]: (state, payload) => update(state, {
      running: { $set: false },
      progress: { $set: -1 },
      directory: { $set: '' },
    }),
  }, defaults: {
    running: false,
    progress: -1,
    directory: '',
  },
};
