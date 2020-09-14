import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, getSafe, merge, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/profiles';

/**
 * reducer for changes to ephemeral session state
 */
export const profilesReducer: IReducerSpec = {
  reducers: {
    [actions.setProfile as any]: (state, payload) =>
      setSafe(state, [payload.id], {
        ...getSafe(state, [payload.id], {}),
        ...payload,
      }),
    [actions.removeProfile as any]: (state, payload) =>
      deleteOrNop(state, [ payload ]),
    [actions.willRemoveProfile as any]: (state, payload) =>
      setSafe(state, [payload, 'pendingRemove'], true),
    [actions.setModEnabled as any]: (state, payload) => {
      const { profileId, modId, enable } = payload;

      if (state[profileId] === undefined) {
        return state;
      }

      if (enable) {
        state = setSafe(state, [profileId, 'modState', modId, 'enabledTime'], Date.now());
      }

      return setSafe(
        state,
        [profileId, 'modState', modId, 'enabled'],
        enable);
    },
    [actions.setProfileActivated as any]: (state, payload) => {
      if (state[payload] === undefined) {
        return state;
      }
      return setSafe(state, [payload, 'lastActivated'], Date.now());
    },
    [actions.forgetMod as any]: (state, payload) =>
      deleteOrNop(state, [payload.profileId, 'modState', payload.modId]),
    [actions.setFeature as any]: (state, payload) => {
      const { profileId, featureId, value } = payload;

      if (state[profileId] === undefined) {
        return state;
      }

      return setSafe(state, [profileId, 'features', featureId], value);
    },
  },
  defaults: {
  },
  verifiers: {
    _: {
      type: 'object',
      deleteBroken: true,
      description: () => `Invalid profile will be removed`,
      elements: {
        gameId: {
          type: 'string',
          description: (input) => `Profile ${input.id} has no game assigned and will be removed`,
          noUndefined: true,
          noNull: true,
          required: true,
          deleteBroken: 'parent',
        },
        name: {
          type: 'string',
          description: (input) => `Profile ${input.id} is missing a name, will set a default`,
          noUndefined: true,
          noNull: true,
          required: true,
          repair: () => '<Invalid>',
        },
      },
    },
  },
};
