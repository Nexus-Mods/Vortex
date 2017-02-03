import {getSafe} from '../../util/storeHelper';

import { IProfile } from './types/IProfile';

import { createSelector } from 'reselect';

const profilesBase = (state) => state.persistent.profiles;

export const activeGameId = (state): string => {
  const profile = activeProfile(state);
  return profile !== undefined ? profile.gameId : undefined;
};

export const gameProfiles =
    createSelector(activeGameId, profilesBase,
                   (gameId: string, profiles: {[id: string]: IProfile}) => {
                     return Object.keys(profiles)
                         .filter((id: string) => profiles[id].gameId === gameId)
                         .map((id: string) => profiles[id]);
                   });

export const activeProfile = (state): IProfile => {
  const profileId = getSafe(state, ['settings', 'profiles', 'activeProfileId'], undefined);
  return getSafe(state, ['persistent', 'profiles', profileId], undefined);
};
