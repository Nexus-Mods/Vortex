import { IReducerSpec } from '../../../types/IExtensionContext';
import { getSafe, setSafe } from '../../../util/storeHelper';

import { setFeature, setModEnabled, setProfile } from '../actions/profiles';

/**
 * reducer for changes to ephemeral session state
 */
export const profilesReducer: IReducerSpec = {
  reducers: {
    [setProfile as any]: (state, payload) =>
      setSafe(state, [payload.id], Object.assign({}, getSafe(state, [payload.id], {}), payload)),
    [setModEnabled as any]: (state, payload) => {
      const { profileId, modId, enable } = payload;

      return setSafe(
        state,
        [profileId, 'modState', modId, 'enabled'],
        enable);
    },
    [setFeature as any]: (state, payload) => {
      const { profileId, featureId, value } = payload;
      return setSafe(state, [profileId, 'features', featureId], value);
    },
  },
  defaults: {
  },
};
