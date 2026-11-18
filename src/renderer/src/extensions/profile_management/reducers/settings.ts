import { actionsToReducerSpec } from "../../../reducers/builder";
import type { ISettingsProfiles } from "../../../types/IState";
import { clearLastActiveProfile, setCurrentProfile, setNextProfile } from "../actions/settings";

const settingsActions = { setNextProfile, setCurrentProfile, clearLastActiveProfile };

export const settingsReducer = actionsToReducerSpec<ISettingsProfiles, typeof settingsActions>(
  {
    nextProfileId: undefined,
    activeProfileId: undefined,
    lastActiveProfile: {},
  },
  settingsActions,
  {
    setNextProfile: (state, payload) => ({ ...state, nextProfileId: payload.profileId }),
    setCurrentProfile: (state, payload) => {
      const { gameId, profileId } = payload;
      const res = { ...state, activeProfileId: profileId };
      if (gameId === undefined) {
        return res;
      }
      return { ...res, lastActiveProfile: { ...state.lastActiveProfile, [gameId]: profileId } };
    },
    clearLastActiveProfile: (state, payload) => {
      // Theoretically we could assign the next available profile here instead
      //  of completely deleting the game entry..
      const { lastActiveProfile } = state;
      if (lastActiveProfile === undefined || !Object.hasOwn(lastActiveProfile, payload.gameId)) {
        return state;
      }
      const { [payload.gameId]: _, ...rest } = lastActiveProfile;
      return { ...state, lastActiveProfile: rest };
    },
  },
);
