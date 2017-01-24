/**
 * Manages profiles
 *
 * New API:
 *  registerProfileFile(gameId: string, filePath: string) - registers a file to be
 *    included in the profile so it gets stored in the profile and switched when the
 *    profile gets changed
 * State:
 *   gameSettings.profiles.currentProfile: string - currently active profile id
 *   gameSettings.profiles.profiles: { [id: string]: IProfile } - dictionary of all profiles
 * Actions:
 *   setProfile(profile: IProfile) - adds a new profile or changes an existing one
 *   setCurrentProfile(id: string) - activates a profile
 *   setModEnabled(modId: string, enabled: boolean) -
 *      enables or disables a mod in the current profile
 */

import { setCurrentProfile } from './actions/profiles';

import { IExtensionContext } from '../../types/IExtensionContext';
import { showError } from '../../util/message';
import { currentGame, currentProfile, getSafe } from '../../util/storeHelper';

import { IGameStored } from '../gamemode_management/types/IStateEx';

import { profilesReducer } from './reducers/profiles';
import ProfileView from './views/ProfileView';

import { syncFromProfile, syncToProfile } from './sync';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

let profileFiles: { [gameId: string]: string[] } = {};

function profilePath(store: Redux.Store<any>): Promise<string> {
  let app = appIn || remote.app;
  return currentGame(store)
  .then((game: IGameStored) => {
    let profileName = currentProfile(store.getState()).id;
    return path.join(app.getPath('userData'), game.id, 'profiles', profileName);
  });
}

function checkProfile(store: Redux.Store<any>, currentProfile: string): Promise<void> {
  if (currentProfile === undefined) {
    // no profile set, find a fallback if possible
    if ('default' in store.getState().gameSettings.profiles) {
      store.dispatch(setCurrentProfile('default'));
    } else {
      let profiles = Object.keys(store.getState().gameSettings.profiles);
      if (profiles.length > 0) {
        store.dispatch(setCurrentProfile(profiles[0]));
      }
    }
  }

  return profilePath(store)
  .then((currentProfilePath: string) => {
    return fs.ensureDirAsync(currentProfilePath);
  });
}

function currentGameId(state: any) {
  return getSafe(state, ['settings', 'gameMode', 'current'], undefined);
}

function refreshProfile(store: Redux.Store<any>, direction: 'import' | 'export') {
  return checkProfile(store, currentProfile(store.getState()).id)
      .then(() => {
        return profilePath(store);
      })
      .then((currentProfilePath: string) => {
        // if this is the first sync, we assume the files on disk belong
        // to the profile that was last active in nmm2. This could only be
        // false if the profile was somehow changed before without a
        // syncFromProfile happening. Of course if the profile was never
        // loaded then it has no copies of the files but that if fine.
        const gameId = currentGameId(store.getState());
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

export interface IExtensionContextExt extends IExtensionContext {
  registerProfileFile: (gameId: string, filePath: string) => void;
}

function init(context: IExtensionContextExt): boolean {
  context.registerMainPage('clone', 'Profiles', ProfileView, {
    hotkey: 'P',
    visible: () => context.api.store.getState().settings.gameMode.current,
  });

  context.registerReducer(['gameSettings', 'profiles'], profilesReducer);

  context.registerProfileFile = (gameId: string, filePath: string) => {
    if (profileFiles[gameId] === undefined) {
      profileFiles[gameId] = [];
    }
    profileFiles[gameId].push(filePath);
  };

  // ensure the current profile is always set to a valid value on startup and
  // when changing the game mode 
  context.once(() => {
    let store = context.api.store;
    let lastGame = undefined;

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      // when the game changes it's assumed that the "global" files are
      // associated with the active profile because you can't change the
      // profile without activating the game first
      return refreshProfile(store, 'import')
      .then(() => {
        context.api.events.emit('profile-activated',
          store.getState().gameSettings.profiles.currentProfile);
      });
    });

    context.api.onStateChange(['gameSettings', 'profiles', 'currentProfile'],
      (prev: string, current: string) => {
        let newGame = currentGameId(store.getState());
        // if the game mode has changed, don't trigger the profile refresh here
        // because that already happened in the previous state change handler
        if (lastGame === newGame) {
          // same game, different profile.
          refreshProfile(store, 'export')
              .then(() => {
                context.api.events.emit('profile-activated', current);
              });
        } else {
          lastGame = newGame;
        }
    });
  });

  return true;
}

export default init;
