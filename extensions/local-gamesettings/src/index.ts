import {
  backupPath, gameSettingsFiles, gameSupported,
  mygamesPath, profilePath,
} from './util/gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { log, selectors, types, util } from 'nmm-api';
import * as path from 'path';

function copyGameSettings(
  sourcePath: string,
  destinationPath: string,
  gameSettingsFiles: string[],
  copyType: string): Promise<void> {

  return Promise.map(gameSettingsFiles, (gameSetting: string) => {
    const source = path.join(sourcePath, gameSetting);
    const destination = path.join(destinationPath, path.basename(gameSetting));

    log('debug', 'copying profile inis', {source, destination});

    return fs.copyAsync(path.join(sourcePath, gameSetting), destination)
      .catch((err) => {
        switch (copyType) {
          // backup missing, create it now from global file
          case 'BacGlo': return fs.copyAsync(destination, source);
          // profile ini missing, create it now from global file
          case 'ProGlo': return fs.copyAsync(destination, source);
          // fatal error
          default: return Promise.reject(err);
        }
      });
  })
  .then(() => undefined);
}

function checkGlobalFiles(oldProfile: types.IProfile,
                          newProfile: types.IProfile) {
  const fileList: string[] = [].concat(
    gameSettingsFiles(oldProfile.gameId, mygamesPath(oldProfile.gameId)),
    gameSettingsFiles(newProfile.gameId, mygamesPath(newProfile.gameId)));

  return Promise.map(fileList,
                     file =>
                         fs.statAsync(file).then(() => null).catch(() => file))
      .then((missingFiles: string[]) => {
        missingFiles = missingFiles.filter(file => file !== null);
        if (missingFiles.length > 0) {
          return Promise.reject(missingFiles);
        } else {
          return Promise.resolve(null);
        }
      });
}

function updateLocalGameSettings(featureId: string, oldProfile: types.IProfile,
                                 newProfile: types.IProfile) {
  let copyFiles: Promise<void> = Promise.resolve();
  if ((oldProfile !== null)
      && (oldProfile.features !== undefined)
      && oldProfile.features[featureId]) {

    if (!gameSupported(oldProfile.gameId)) {
        return Promise.reject('Unsupported game.');
    }

    // revert game settings for game that was previously active
    const myGames = mygamesPath(oldProfile.gameId);
    const gameSettings = gameSettingsFiles(oldProfile.gameId, null);

    copyFiles = copyFiles
    // re-import global files to profile
    .then(() => copyGameSettings(myGames, profilePath(oldProfile),
                                 gameSettings, 'GloPro'))
    // restore backup
    .then(() => copyGameSettings(backupPath(oldProfile), myGames,
                                 gameSettings, 'BacGlo'));
  }

  if ((newProfile.features !== undefined) && (newProfile.features[featureId])) {

    if (!gameSupported(newProfile.gameId)) {
        return Promise.reject('Unsupported game.');
    }

    // install game settings for game&profile that will now be active
    const myGames = mygamesPath(newProfile.gameId);
    const gameSettings = gameSettingsFiles(newProfile.gameId, null);

    copyFiles = copyFiles
    // backup global files
    .then(() => copyGameSettings(myGames, backupPath(newProfile),
                                 gameSettings, 'GloBac'))
    // install profile files
    .then(() => copyGameSettings(profilePath(newProfile),
                                 myGames, gameSettings, 'ProGlo'));
  }

  return Promise.resolve(copyFiles);
}

function init(context): boolean {
  context.registerProfileFeature(
    'local_game_settings', 'boolean', 'cog', 'This profile has its own game settings',
    () => gameSupported(selectors.activeGameId(context.api.store.getState())));

  context.once(() => {
    const store: Redux.Store<types.IState> = context.api.store;

    context.api.onStateChange(['settings', 'profiles', 'activeProfileId'],
      (prev: string, current: string) => {
        const state = store.getState();

        const oldProfile = util.getSafe(state, ['persistent', 'profiles', prev], null);
        const newProfile = state.persistent.profiles[current];

        checkGlobalFiles(oldProfile, newProfile)
          .then(() =>
            updateLocalGameSettings('local_game_settings', oldProfile, newProfile)
              .catch((err) => {
                util.showError(store.dispatch,
                  'An error occured during the profile activation.', err + '\n\n' +
                  'An error occurred copying the profile game settings.\nDuring the copy ' +
                  'we noticed that files that should have been under our control are ' +
                  'inaccessible.\nWe don\'t like unauthorized intrusions. Put your paws down!');
                return false;
              }),
          )
          .catch((missingFiles: string[]) => {
            const fileList = missingFiles.join('\n');
            util.showError(store.dispatch, 'An error occured during the profile activation',
              'These files are missing or not writeable:\n' + fileList + '\n\n' +
              'We suggest you to run the game at least once.');
            return false;
          });
      });

  });
  return true;
}

export default init;
