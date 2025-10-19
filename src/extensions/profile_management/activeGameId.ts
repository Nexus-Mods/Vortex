import {getSafe} from '../../util/storeHelper';
import { IProfile } from './types/IProfile';
import { IState } from '../../types/IState';
import createCachedSelector from 're-reselect';

export const activeProfile = (state): IProfile => {
  const profileId = getSafe(state, ['settings', 'profiles', 'activeProfileId'], undefined);
  return getSafe(state, ['persistent', 'profiles', profileId], undefined);
};

export const activeGameId = (state: IState): string => {
  const profile = activeProfile(state);
  return profile !== undefined ? profile.gameId : undefined;
};

const lastActiveProfiles = (state: IState) => state.settings.profiles.lastActiveProfile;

export const lastActiveProfileForGame = createCachedSelector(
  lastActiveProfiles,
  (state: IState, gameId: string) => gameId,
  (lastActiveProfilesIn: { [gameId: string]: string }, gameId: string) =>
    lastActiveProfilesIn[gameId])((state, gameId) => gameId);