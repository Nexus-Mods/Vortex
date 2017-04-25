import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, getSafe, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/profiles';

/**
 * reducer for changes to ephemeral session state
 */
export const profilesReducer: IReducerSpec = {
  reducers: {
    [actions.setProfile as any]: (state, payload) =>
      setSafe(state, [payload.id], Object.assign({}, getSafe(state, [payload.id], {}), payload)),
    [actions.removeProfile as any]: (state, payload) =>
      deleteOrNop(state, [ payload ]),
    [actions.setModEnabled as any]: (state, payload) => {
      const { profileId, modId, enable } = payload;

      if (state[profileId] === undefined) {
        return state;
      }

      return setSafe(
        state,
        [profileId, 'modState', modId, 'enabled'],
        enable);
    },
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
};
