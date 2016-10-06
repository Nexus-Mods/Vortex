import { IReducerSpec } from '../../../types/IExtensionContext';
import { setCurrentProfile, setModEnabled, setProfile } from '../actions/profiles';
import { IProfileSettings } from '../types/IStateEx';
import update = require('react-addons-update');

function ensureMod(state: IProfileSettings, modId: string): IProfileSettings {
  if (!(modId in state.profiles[state.currentProfile].modState)) {
    return update(state, {
      profiles: {
        [state.currentProfile]: {
          modState: {
            [modId]: { $set: {} },
          },
        },
      },
    });
  } else {
    return state;
  }
}

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
    [setModEnabled]: (state, payload) => {
      const { modId, enable } = payload;
      return update(ensureMod(state, modId), {
        profiles: {
          [state.currentProfile]: {
            modState: {
              [modId]: {
                enabled: { $set: enable },
              },
            },
          },
        },
      });
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
