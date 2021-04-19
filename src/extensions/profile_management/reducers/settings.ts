import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, setSafe } from '../../../util/storeHelper';

import { clearLastActiveProfile, setCurrentProfile, setNextProfile } from '../actions/settings';

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
    [clearLastActiveProfile as any]: (state, payload) =>
      // Theoretically we could assign the next available profile here instead
      //  of completely deleting the game entry..
      deleteOrNop(state, ['lastActiveProfile', payload.gameId]),
  },
  defaults: {
    nextProfileId: undefined,
    activeProfileId: undefined,
    lastActiveProfile: {},
  },
};
