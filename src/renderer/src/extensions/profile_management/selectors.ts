import { createCachedSelector } from "re-reselect";
import { createSelector } from "reselect";

import type { IGameStored, IState } from "../../types/IState";
import type { IProfile } from "./types/IProfile";

export const profiles = (state: IState) => state.persistent.profiles;
export const lastActiveProfiles = (state: IState) => state.settings.profiles.lastActiveProfile;

export const activeGameId = (state: IState): string => {
  const profile = activeProfile(state);
  return profile !== undefined ? profile.gameId : undefined;
};

export const gameProfiles = createSelector(
  activeGameId,
  profiles,
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

export const knownGameForName = (state: IState, name: string): IGameStored | undefined => {
  const extPathLookup = Object.values(state.app.extensions ?? {}).reduce(
    (prev, ext) => {
      prev[ext.path] = ext.name;
      return prev;
    },
    {} as { [path: string]: string },
  );

  return state.session.gameMode.known.find(
    (iter) => iter.id === name || extPathLookup[iter.extensionPath] === name,
  );
};

export const commandLineGameId = (state: IState): string | undefined => {
  const { commandLine } = state.session.base;
  if (commandLine?.profile !== undefined) {
    return state.persistent.profiles[commandLine.profile]?.gameId;
  }
  return commandLine?.game !== undefined
    ? knownGameForName(state, commandLine.game)?.id
    : undefined;
};

const profileByIdImpl = createCachedSelector(
  profiles,
  (state: IState, profileId: string) => profileId,
  (profilesIn: { [profileId: string]: IProfile }, profileId: string) => profilesIn[profileId],
)((state, profileId) => profileId);

export function profileById(state: IState, profileId: string) {
  if (profileId === undefined) {
    return undefined;
  }

  return profileByIdImpl(state, profileId);
}

export const enabledModCountForProfile = createCachedSelector(
  (state: IState) => state.persistent.mods,
  (state: IState, profileId: string) => profileById(state, profileId),
  (mods, profile): number => {
    if (profile?.modState === undefined) {
      return 0;
    }
    const gameMods = mods[profile.gameId] ?? {};
    return Object.keys(profile.modState).filter(
      (id) => profile.modState[id]?.enabled && gameMods[id]?.state === "installed",
    ).length;
  },
)((state, profileId) => profileId ?? "___empty");

export const lastActiveProfileForGame = createCachedSelector(
  lastActiveProfiles,
  (state: IState, gameId: string) => gameId,
  (lastActiveProfilesIn: { [gameId: string]: string }, gameId: string) =>
    lastActiveProfilesIn[gameId],
  // Callers pass activeGameId, which is undefined whenever no game is active, and
  // re-reselect refuses an undefined cache key. Park those on one entry, as
  // enabledModCountForProfile does.
)((state, gameId) => gameId ?? "___empty");
