import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setCurrentProfile, setModEnabled, setProfile } from '../actions/profiles';

import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const profilesReducer: IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']: (state, payload) => {
      if (payload.hasOwnProperty('gameSettings') &&
          payload.gameSettings.hasOwnProperty('profiles')) {
        return update(state, { $set: payload.gameSettings.profiles });
      } else {
        return state;
      }
    },
    [setProfile]: (state, payload) => {
      return update(state, { profiles: { [payload.id]: { $set: payload } } });
    },
    [setCurrentProfile]: (state, payload) => {
      return update(state, { currentProfile: { $set: payload } });
    },
    [setModEnabled]: (state, payload) => {
      const { modId, enable } = payload;

      return setSafe(
        state,
        ['profiles', state.currentProfile, 'modState', modId, 'enabled'],
        enable);
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
