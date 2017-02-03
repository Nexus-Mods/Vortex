import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setModEnabled, setProfile } from '../actions/profiles';

/**
 * reducer for changes to ephemeral session state
 */
export const profilesReducer: IReducerSpec = {
  reducers: {
    [setProfile]: (state, payload) => {
      return setSafe(state, [payload.id], payload);
    },
    [setModEnabled]: (state, payload) => {
      const { profileId, modId, enable } = payload;

      return setSafe(
        state,
        [profileId, 'modState', modId, 'enabled'],
        enable);
    },
  },
  defaults: {
  },
};
