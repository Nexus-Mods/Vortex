import { setCurrentProfile, setProfile } from '../actions/profiles';
import { IReducerSpec } from '../types/IExtensionContext';
import update = require('react-addons-update');

import { log } from '../util/log';

/**
 * reducer for changes to ephemeral session state
 */
export const profilesReducer: IReducerSpec = {
  reducers: {
    [setProfile]: (state, payload) => {
      return update(state, { profiles: { [payload.id]: { $set: payload } } });
    },
    [setCurrentProfile]: (state, payload) => {
      return update(state, { currentProfile: { $set: payload } });
    },
  },
  defaults: {
    currentProfile: 'default',
    profiles: {
      default: {
        id: 'default',
        name: 'Default',
        modState: {},
      },
    },
  },
};
