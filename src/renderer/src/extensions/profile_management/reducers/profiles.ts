import { actionsToReducerSpec } from "../../../reducers/builder";
import type { IPersistentState } from "../../../types/IState";
import {
  forgetMod,
  removeProfile,
  setFeature,
  setModEnabled,
  setProfile,
  setProfileActivated,
  willRemoveProfile,
} from "../actions/profiles";

const profileActions = {
  setProfile,
  removeProfile,
  willRemoveProfile,
  setModEnabled,
  setProfileActivated,
  forgetMod,
  setFeature,
};

/**
 * reducer for changes to the profiles (persistent.profiles, keyed by profile id)
 */
export const profilesReducer = actionsToReducerSpec<
  IPersistentState["profiles"],
  typeof profileActions
>(
  {},
  profileActions,
  {
    setProfile: (state, payload) => ({
      ...state,
      [payload.id]: { ...state[payload.id], ...payload },
    }),
    removeProfile: (state, payload) => {
      if (!Object.hasOwn(state, payload)) {
        return state;
      }
      const { [payload]: _, ...rest } = state;
      return rest;
    },
    willRemoveProfile: (state, payload) => {
      const profile = state[payload];
      if (profile === undefined) {
        return state;
      }
      return { ...state, [payload]: { ...profile, pendingRemove: true } };
    },
    setModEnabled: (state, payload) => {
      const { profileId, modId, enable } = payload;

      const profile = state[profileId];
      if (profile === undefined) {
        return state;
      }

      // Stamp only the timestamp for this transition; the other is left intact so the analytics
      // can measure how long the mod spent in the prior state.
      const timeKey = enable ? "enabledTime" : "disabledTime";
      return {
        ...state,
        [profileId]: {
          ...profile,
          modState: {
            ...profile.modState,
            [modId]: { ...profile.modState?.[modId], [timeKey]: Date.now(), enabled: enable },
          },
        },
      };
    },
    setProfileActivated: (state, payload) => {
      const profile = state[payload];
      if (profile === undefined) {
        return state;
      }
      return { ...state, [payload]: { ...profile, lastActivated: Date.now() } };
    },
    forgetMod: (state, payload) => {
      const { profileId, modId } = payload;
      const profile = state[profileId];
      if (
        profile === undefined ||
        profile.modState === undefined ||
        !Object.hasOwn(profile.modState, modId)
      ) {
        return state;
      }
      const { [modId]: _, ...modState } = profile.modState;
      return { ...state, [profileId]: { ...profile, modState } };
    },
    setFeature: (state, payload) => {
      const { profileId, featureId, value } = payload;

      const profile = state[profileId];
      if (profile === undefined) {
        return state;
      }

      return {
        ...state,
        [profileId]: { ...profile, features: { ...profile.features, [featureId]: value } },
      };
    },
  },
  {
    _: {
      type: "object",
      deleteBroken: true,
      description: () => `Invalid profile will be removed`,
      elements: {
        gameId: {
          type: "string",
          description: (input) => `Profile ${input.id} has no game assigned and will be removed`,
          noUndefined: true,
          noNull: true,
          required: true,
          deleteBroken: "parent",
        },
        name: {
          type: "string",
          description: (input) => `Profile ${input.id} is missing a name, will set a default`,
          noUndefined: true,
          noNull: true,
          required: true,
          repair: () => "<Invalid>",
        },
        // an empty mod state isn't persisted, so a profile with no mod ever enabled loads without one
        modState: {
          type: "object",
          description: () => "Profile has no mod states",
          noNull: true,
          required: true,
          silent: true,
          repair: () => ({}),
        },
      },
    },
  },
);
