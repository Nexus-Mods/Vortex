import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setCurrentProfile, setNextProfile } from '../actions/settings';

export const settingsReducer: IReducerSpec = {
  reducers: {
    [setNextProfile]: (state, payload) => {
      return setSafe(state, ['nextProfileId'], payload.profileId);
    },
    [setCurrentProfile]: (state, payload) => {
      const { gameId, profileId } = payload;
      let res = setSafe(state, ['activeProfileId'], profileId);
      res = setSafe(res, ['lastActiveProfile', gameId], profileId);
      return res;
    },
  },
  defaults: {
    nextProfileId: undefined,
    activeProfileId: undefined,
    lastActiveProfile: {},
  },
};
