import {getSafe} from '../../util/storeHelper';

import { IProfile } from './types/IProfile';

import { createSelector, OutputSelector } from 'reselect';
import createCachedSelector, { ICacheObject, ParametricSelector, OutputParametricSelector } from 're-reselect';
import { IState } from '../../types/IState';

const profilesBase = (state: IState) => state.persistent.profiles;
const lastActiveProfiles = (state: IState) => state.settings.profiles.lastActiveProfile;

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

export const profileById = createCachedSelector(profilesBase, (state: IState, profileId: string) => profileId,
  (profilesBase: { [profileId: string]: IProfile }, profileId: string) => profilesBase[profileId])((state, profileId) => profileId);

export const lastActiveProfileForGame = createCachedSelector(lastActiveProfiles, (state: IState, gameId: string) => gameId,
  (lastActiveProfiles: { [gameId: string]: string }, gameId: string) => lastActiveProfiles[gameId])((state, gameId) => gameId);
