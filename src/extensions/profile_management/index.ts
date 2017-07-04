/**
 * Manages profiles
 *
 * New API:
 *  registerProfileFile(gameId: string, filePath: string) - registers a file to be
 *    included in the profile so it gets stored in the profile and switched when the
 *    profile gets changed
 * State:
 *   settings.profiles.activeProfileId: string - currently active profile id
 *   persistent.profiles: { [gameId: string]: { [profileId: string]: IProfile } } -
 *      dictionary of all profiles
 * Actions:
 *   setProfile(gameId: string, profile: IProfile) - adds a new profile or changes an existing one
 *   setNextProfile(gameId: string, profileId: string) - activates a profile
 *   setModEnabled(gameId: string, profileId: string, modId: string, enabled: boolean) -
 *      enables or disables a mod in the current profile
 */

import { IDialogResult, showDialog } from '../../actions/notifications';

import { IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { showError } from '../../util/message';
import { getSafe } from '../../util/storeHelper';

import { setProfile } from './actions/profiles';
import { setCurrentProfile, setNextProfile } from './actions/settings';
import { profilesReducer } from './reducers/profiles';
import { settingsReducer } from './reducers/settings';
import { IProfile } from './types/IProfile';
import { IProfileFeature } from './types/IProfileFeature';
import ProfileView from './views/ProfileView';

import { activeGameId, activeProfile } from './selectors';
import { syncFromProfile, syncToProfile } from './sync';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { generate as shortid } from 'shortid';

const profileFiles: { [gameId: string]: string[] } = {};

const profileFeatures: IProfileFeature[] = [];

function profilePath(store: Redux.Store<any>, profile: IProfile): string {
  const app = appIn || remote.app;

  return path.join(app.getPath('userData'), profile.gameId, 'profiles', profile.id);
}

function checkProfile(store: Redux.Store<any>, currentProfile: IProfile): Promise<void> {
  return fs.ensureDirAsync(profilePath(store, currentProfile));
}

function refreshProfile(store: Redux.Store<any>, profile: IProfile,
                        direction: 'import' | 'export') {
  if (profile === undefined) {
    return Promise.resolve();
  }
  return checkProfile(store, profile)
      .then(() => {
        return profilePath(store, profile);
      })
      .then((currentProfilePath: string) => {
        // if this is the first sync, we assume the files on disk belong
        // to the profile that was last active in Vortex. This could only be
        // false if the profile was somehow changed before without a
        // syncFromProfile happening. Of course if the profile was never
        // loaded then it has no copies of the files but that if fine.
        const gameId = profile.gameId;
        if (profileFiles[gameId] === undefined) {
          return Promise.resolve();
        }
        if (direction === 'import') {
          return syncToProfile(currentProfilePath, profileFiles[gameId],
            (error, detail) => showError(store.dispatch, error, detail));
        } else {
          return syncFromProfile(currentProfilePath, profileFiles[gameId],
            (error, detail) => showError(store.dispatch, error, detail));
        }
      })
      .catch((err: Error) => {
        showError(store.dispatch, 'Failed to set profile', err);
      })
      ;
}

/**
 * activate the specified game (using the last active profile for that game).
 * Will ask the user if the game was never active (how would this happen?)
 *
 * @param {string} gameId
 */
function activateGame(store: Redux.Store<IState>, gameId: string) {
  const state: IState = store.getState();
  const profileId = getSafe(state, ['settings', 'profiles', 'lastActiveProfile', gameId],
    undefined);
  if (profileId === undefined) {
    const profiles = getSafe(state, ['persistent', 'profiles'], []);
    const gameProfiles: IProfile[] = Object.keys(profiles)
      .filter((id: string) => profiles[id].gameId === gameId)
      .map((id: string) => profiles[id]);
    store.dispatch(showDialog('question', 'Choose profile', {
      message: 'Please choose the profile to use with this game',
      choices: gameProfiles.map((profile: IProfile, idx: number) =>
        ({ id: profile.id, text: profile.name, value: idx === 0 })),
    }, {
        Activate: null,
      }))
      .then((dialogResult: IDialogResult) => {
        if (dialogResult.action === 'Activate') {
          const selectedId = Object.keys(dialogResult.input).find(
            (id: string) => dialogResult.input[id]);
          store.dispatch(setNextProfile(selectedId));
        }
      });
  } else {
    store.dispatch(setNextProfile(profileId));
  }
}

export interface IExtensionContextExt extends IExtensionContext {
  registerProfileFile: (gameId: string, filePath: string) => void;
  registerProfileFeature: (featureId: string, type: string, icon: string, description: string,
                           supported: () => boolean) => void;
}

function init(context: IExtensionContextExt): boolean {
  context.registerMainPage('profiles', 'Profiles', ProfileView, {
    hotkey: 'P',
    group: 'global',
    visible: () => (activeGameId(context.api.store.getState()) !== undefined)
      && (context.api.store.getState().settings.interface.profilesVisible),
    props: () => ({ features: profileFeatures }),
  });

  context.registerReducer(['persistent', 'profiles'], profilesReducer);
  context.registerReducer(['settings', 'profiles'], settingsReducer);

  context.registerAction('game-discovered-buttons', 100, 'favorite', {
    noCollapse: true,
  }, 'Manage',
    (instanceIds: string[]) => {
      const profileId = shortid();
      const gameId = instanceIds[0];
      context.api.store.dispatch(setProfile({
        id: profileId,
        gameId,
        name: 'Default',
        modState: {},
      }));
      context.api.store.dispatch(setNextProfile(profileId));
  });

  context.registerAction('game-managed-buttons', 100, 'play', {
    noCollapse: true,
  }, 'Activate', (instanceIds: string[]) => {
    activateGame(context.api.store, instanceIds[0]);
  }, (instanceIds: string[]) =>
      activeGameId(context.api.store.getState()) !== instanceIds[0],
  );

  context.registerProfileFile = (gameId: string, filePath: string) => {
    if (profileFiles[gameId] === undefined) {
      profileFiles[gameId] = [];
    }
    profileFiles[gameId].push(filePath);
  };

  context.registerProfileFeature =
      (featureId: string, type: string, icon: string, description: string,
       supported: () => boolean) => {
        profileFeatures.push({
          id: featureId,
          type,
          icon,
          description,
          supported,
        });
      };

  // ensure the current profile is always set to a valid value on startup and
  // when changing the game mode
  context.once(() => {
    const store = context.api.store;

    context.api.events.on('activate-game', (gameId: string) => {
      activateGame(store, gameId);
    });

    context.api.onStateChange(
        ['settings', 'profiles', 'nextProfileId'],
        (prev: string, current: string) => {
          const state: IState = store.getState();
          const profile = state.persistent.profiles[current];
          refreshProfile(store, profile, 'export')
              .then(() => {
                store.dispatch(setCurrentProfile(profile.gameId, current));
              })
              .catch((err: Error) => {
            showError(store.dispatch, 'Failed to set profile', err);
          });
        });

    context.api.onStateChange(['settings', 'profiles', 'activeProfileId'],
                              (prev: string, current: string) => {
                                context.api.events.emit('profile-activated',
                                                        current);
                              });
    const initProfile = activeProfile(store.getState());
    refreshProfile(store, initProfile, 'import')
        .then(() => {
          if (initProfile !== undefined) {
            context.api.events.emit('profile-activated', initProfile.id);
          }
        })
         .catch((err: Error) => {
            showError(store.dispatch, 'Failed to set profile', err);
          });

    context.api.onStateChange(
        ['persistent', 'profiles'], (prev: string, current: string) => {
          Object.keys(current).forEach(profileId => {
            if (prev[profileId] === current[profileId]) {
              return;
            }

            const prevState = getSafe(prev, [profileId, 'modState'], {});
            const currentState = getSafe(current, [profileId, 'modState'], {});

            if (prevState !== currentState) {
              Object.keys(currentState)
                  .forEach(modId => {
                    const isEnabled =
                        getSafe(currentState, [modId, 'enabled'], false);
                    const wasEnabled =
                        getSafe(prevState, [modId, 'enabled'], false);

                    if (isEnabled !== wasEnabled) {
                      context.api.events.emit(
                          isEnabled ? 'mod-enabled' : 'mod-disabled', profileId,
                          modId);
                    }
                  });
            }
          });
        });
  });

  return true;
}

export default init;
