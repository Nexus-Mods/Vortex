import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setCurrentProfile } from '../actions/settings';

export const settingsReducer: IReducerSpec = {
  reducers: {
    [setCurrentProfile]: (state, payload) => {
      const { gameId, profileId } = payload;
      let res = setSafe(state, ['activeProfileId'], profileId);
      res = setSafe(res, ['lastActiveProfile', gameId], profileId);
      return res;
    },
  },
  defaults: {
    activeProfileId: undefined,
    lastActiveProfile: {},
  },
};
