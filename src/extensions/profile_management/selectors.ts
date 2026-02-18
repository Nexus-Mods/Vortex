import { getSafe } from "../../renderer/util/storeHelper";
import type { IProfile } from "./types/IProfile";
import { createCachedSelector } from "re-reselect";
import { createSelector } from "reselect";
import type { IState } from "../../renderer/types/IState";

const profilesBase = (state: IState) => state.persistent.profiles;
export const lastActiveProfiles = (state: IState) =>
  state.settings.profiles.lastActiveProfile;

export const activeGameId = (state: IState): string => {
  const profile = activeProfile(state);
  return profile !== undefined ? profile.gameId : undefined;
};

export const gameProfiles = createSelector(
  activeGameId,
  profilesBase,
  (gameId: string, profiles: { [id: string]: IProfile }) => {
    return Object.keys(profiles)
      .filter((id: string) => profiles[id].gameId === gameId)
      .map((id: string) => profiles[id]);
  },
);

export const activeProfileId = (state: IState): string | undefined =>
  state.settings.profiles.activeProfileId;

export const nextProfileId = (state: IState): string | undefined =>
  state.settings.profiles.nextProfileId;

export const activeProfile = (state: IState): IProfile | undefined => {
  const profileId = activeProfileId(state);
  if (profileId === undefined) {
    return undefined;
  }
  return state.persistent.profiles[profileId];
};

const profileByIdImpl = createCachedSelector(
  profilesBase,
  (state: IState, profileId: string) => profileId,
  (profilesBaseIn: { [profileId: string]: IProfile }, profileId: string) =>
    profilesBaseIn[profileId],
)((state, profileId) => profileId);

export function profileById(state: IState, profileId: string) {
  if (profileId === undefined) {
    return undefined;
  }

  return profileByIdImpl(state, profileId);
}

export const lastActiveProfileForGame = createCachedSelector(
  lastActiveProfiles,
  (state: IState, gameId: string) => gameId,
  (lastActiveProfilesIn: { [gameId: string]: string }, gameId: string) =>
    lastActiveProfilesIn[gameId],
)((state, gameId) => gameId);
