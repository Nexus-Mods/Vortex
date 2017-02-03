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
 *   setCurrentProfile(gameId: string, profileId: string) - activates a profile
 *   setModEnabled(gameId: string, profileId: string, modId: string, enabled: boolean) -
 *      enables or disables a mod in the current profile
 */

import { IDialogResult, showDialog } from '../../actions/notifications';

import { IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { showError } from '../../util/message';
import { currentGame, getSafe } from '../../util/storeHelper';

import { IGameStored } from '../gamemode_management/types/IGameStored';

import { setProfile } from './actions/profiles';
import { setCurrentProfile } from './actions/settings';
import { profilesReducer } from './reducers/profiles';
import { settingsReducer } from './reducers/settings';
import { IProfile } from './types/IProfile';
import ProfileView from './views/ProfileView';

import { activeGameId, activeProfile, gameProfiles } from './selectors';
import { syncFromProfile, syncToProfile } from './sync';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { generate as shortid } from 'shortid';

let profileFiles: { [gameId: string]: string[] } = {};

function profilePath(store: Redux.Store<any>): Promise<string> {
  let app = appIn || remote.app;
  return currentGame(store)
  .then((game: IGameStored) => {
    let profileName = activeProfile(store.getState()).id;
    return path.join(app.getPath('userData'), game.id, 'profiles', profileName);
  });
}

function checkProfile(store: Redux.Store<any>, currentProfile: string): Promise<void> {
  if (currentProfile === undefined) {
    // no profile set, find a fallback if possible
    let profiles = gameProfiles(store.getState());
    if (profiles['default'] !== undefined) {
      store.dispatch(setCurrentProfile('default'));
    } else {
      let profileIds = Object.keys(profiles);
      if (profileIds.length > 0) {
        store.dispatch(setCurrentProfile(profileIds[0]));
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
  return checkProfile(store, activeProfile(store.getState()).id)
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
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
  });

  context.registerReducer(['persistent', 'profiles'], profilesReducer);
  context.registerReducer(['settings', 'profiles'], settingsReducer);

  context.registerIcon('game-discovered-buttons', 'asterisk', 'Manage', (instanceIds: string[]) => {
    let profileId = shortid();
    let gameId = instanceIds[0];
    context.api.store.dispatch(setProfile({
      id: profileId,
      gameId,
      name: 'Default',
      modState: {},
    }));
    context.api.store.dispatch(setCurrentProfile(gameId, profileId));
  });

  context.registerIcon('game-managed-buttons', 'play', 'Activate', (instanceIds: string[]) => {
    let store = context.api.store;
    let state: IState = store.getState();
    let gameId = instanceIds[0];
    let profileId = getSafe(state, ['settings', 'profiles', 'lastActiveProfile', gameId],
                            undefined);
    if (profileId === undefined) {
      let profiles = getSafe(state, ['persistent', 'profiles'], []);
      let gameProfiles: IProfile[] = Object.keys(profiles)
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
          let selectedId = Object.keys(dialogResult.input).find(
            (id: string) => dialogResult.input[id]);
          store.dispatch(setCurrentProfile(gameId, selectedId));
        }
      });
    } else {
      store.dispatch(setCurrentProfile(gameId, profileId));
    }
  });

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

    Object.keys(store.getState().settings.profiles)
        .forEach((gameId: string) => {
          // TODO instead of installing multiple state change observers it should be
          //   be possible to set only one for the whole dict and then figure out what
          //   changed from the prev and current parameters
          context.api.onStateChange(
              ['settings', 'profiles', 'activeProfileId'],
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
  });

  return true;
}

export default init;
