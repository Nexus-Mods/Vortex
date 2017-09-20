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

import { forgetMod, setProfile } from './actions/profiles';
import { setCurrentProfile, setNextProfile } from './actions/settings';
import { profilesReducer } from './reducers/profiles';
import { settingsReducer } from './reducers/settings';
import transferSetupReducer from './reducers/transferSetup';
import { IProfile } from './types/IProfile';
import { IProfileFeature } from './types/IProfileFeature';
import Connector from './views/Connector';
import ProfileView from './views/ProfileView';
import TransferDialog from './views/TransferDialog';

import { activeGameId, activeProfile } from './selectors';
import { syncFromProfile, syncToProfile } from './sync';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as Redux from 'redux';
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

function sanitizeProfile(store: Redux.Store<any>, profile: IProfile): void {
  const state: IState = store.getState();
  Object.keys(profile.modState).forEach(modId => {
    if (getSafe(state.persistent.mods, [profile.gameId, modId], undefined) === undefined) {
      store.dispatch(forgetMod(profile.id, modId));
    }
  });
}

function refreshProfile(store: Redux.Store<any>, profile: IProfile,
                        direction: 'import' | 'export'): Promise<void> {
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
  const profile = getSafe(state, ['persistent', 'profiles', profileId], undefined);
  if ((profileId === undefined) || (profile === undefined)) {
    const profiles = getSafe(state, ['persistent', 'profiles'], []);
    const gameProfiles: IProfile[] = Object.keys(profiles)
      .filter((id: string) => profiles[id].gameId === gameId)
      .map((id: string) => profiles[id]);
    store.dispatch(showDialog('question', 'Choose profile', {
      message: 'Please choose the profile to use with this game',
      choices: gameProfiles.map((iter: IProfile, idx: number) =>
        ({ id: iter.id, text: iter.name, value: idx === 0 })),
    }, [ { label: 'Activate' } ]))
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
  context.registerMainPage('layers', 'Profiles', ProfileView, {
    hotkey: 'P',
    group: 'global',
    visible: () => (activeGameId(context.api.store.getState()) !== undefined)
      && (context.api.store.getState().settings.interface.profilesVisible),
    props: () => ({ features: profileFeatures }),
  });

  context.registerReducer(['persistent', 'profiles'], profilesReducer);
  context.registerReducer(['settings', 'profiles'], settingsReducer);
  context.registerReducer(['session', 'profileTransfer'], transferSetupReducer);

  context.registerAction('game-discovered-buttons', 100, 'play', {
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

    // promise used to ensure a new profile switch can't be started before the last one
    // is complete
    let finishProfileSwitch: () => void;
    let finishProfileSwitchPromise: Promise<void> = Promise.resolve();

    context.api.onStateChange(
        ['settings', 'profiles', 'nextProfileId'],
        (prev: string, current: string) => {
          finishProfileSwitchPromise.then(() => {
            const state: IState = store.getState();
            if (state.settings.profiles.nextProfileId !== current) {
              // cancel if there was another profile switch while we waited
              return null;
            }

            if (state.settings.profiles.activeProfileId === current) {
              // also do nothing if we're actually resetting the nextprofile
              return null;
            }

            finishProfileSwitchPromise = new Promise<void>((resolve, reject) => {
              finishProfileSwitch = resolve;
            });

            const profile = state.persistent.profiles[current];
            if ((profile === undefined) && (current !== undefined)) {
              showError(store.dispatch, 'Tried to set invalid profile', current);
              return Promise.resolve();
            }

            let queue: Promise<void> = Promise.resolve();
            // emit an event notifying about the impending profile change.
            // every listener can return a cb returning a promise which will be
            // awaited
            // before continuing.
            // It would be fun if we could cancel the profile change if one of
            // these promises
            // is rejected but that would only work if we could roll back
            // changes that happened.
            const enqueue = (cb: () => Promise<void>) => {
              queue = queue.then(cb).catch(err => Promise.resolve());
            };

            context.api.events.emit('profile-will-change', current, enqueue);

            if (current === undefined) {
              store.dispatch(setCurrentProfile(undefined, undefined));
              return queue;
            }

            sanitizeProfile(store, profile);
            return queue
                .then(() => refreshProfile(store, profile, 'export'))
                .then(() => {
                  const gameId = profile !== undefined ? profile.gameId : undefined;
                  return store.dispatch(setCurrentProfile(gameId, current));
                })
                .catch((err: Error) => {
                  showError(store.dispatch, 'Failed to set profile', err);
                  // this is very bad. If we're not able to update to the new profile
                  // we'd leave the client in an unusable state here. instead, reset
                  // the profile to unset
                  store.dispatch(setCurrentProfile(undefined, undefined));
                  store.dispatch(setNextProfile(undefined));
                });
          });
        });

    context.api.onStateChange(['settings', 'profiles', 'activeProfileId'],
                              (prev: string, current: string) => {
                                context.api.events.emit('profile-did-change',
                                                        current);
                                finishProfileSwitch();
                              });
    const initProfile = activeProfile(store.getState());
    refreshProfile(store, initProfile, 'import')
        .then(() => {
          if (initProfile !== undefined) {
            context.api.events.emit('profile-did-change', initProfile.id);
          }
          return null;
        })
         .catch((err: Error) => {
            showError(store.dispatch, 'Failed to set profile', err);
            finishProfileSwitch();
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
                  const isEnabled = getSafe(currentState, [modId, 'enabled'], false);
                  const wasEnabled = getSafe(prevState, [modId, 'enabled'], false);

                  if (isEnabled !== wasEnabled) {
                    context.api.events.emit(
                        isEnabled ? 'mod-enabled' : 'mod-disabled', profileId,
                        modId);
                  }
                });
            }
          });
        });
    {
      const state: IState = store.getState();
      if (state.settings.profiles.nextProfileId !==
          state.settings.profiles.activeProfileId) {
        store.dispatch(setNextProfile(state.settings.profiles.activeProfileId));
      }
    }
  });

  context.registerDialog('profile-transfer-connector', Connector);
  context.registerDialog('transfer-dialog-settings', TransferDialog);

  return true;
}

export default init;
