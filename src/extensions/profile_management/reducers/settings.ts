import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setCurrentProfile, setNextProfile } from '../actions/settings';

export const settingsReducer: IReducerSpec = {
  reducers: {
    [setNextProfile as any]: (state, payload) =>
      setSafe(state, ['nextProfileId'], payload.profileId),
    [setCurrentProfile as any]: (state, payload) => {
      const { gameId, profileId } = payload;
      let res = setSafe(state, ['activeProfileId'], profileId);
      if (gameId !== undefined) {
        res = setSafe(res, ['lastActiveProfile', gameId], profileId);
      }
      return res;
    },
  },
  defaults: {
    nextProfileId: undefined,
    activeProfileId: undefined,
    lastActiveProfile: {},
  },
};
