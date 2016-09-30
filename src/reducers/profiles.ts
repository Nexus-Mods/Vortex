import { setCurrentProfile, setModEnabled, setProfile } from '../actions/profiles';
import { IReducerSpec } from '../types/IExtensionContext';
import { IGameSettingsProfiles } from '../types/IState';
import update = require('react-addons-update');

function ensureMod(state: IGameSettingsProfiles, modId: string): IGameSettingsProfiles {
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
