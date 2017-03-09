import {
  backupPath, gameSettingsFiles, gameSupported,
  mygamesPath, profilePath,
} from './util/gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types, util } from 'nmm-api';
import * as path from 'path';

function copyGameSettings(
  sourcePath: string,
  destinationPath: string,
  gameSettingsFiles: string[],
  store: any,
  copyType: string): Promise<void[]> {

  return Promise.map(gameSettingsFiles, (gameSetting: string) => {
    let destPath = path.join(destinationPath, path.basename(gameSetting));
    console.log('copying ' + path.join(sourcePath, gameSetting) + ' to ' + destPath);
    // throw new Error(`testing fatal error`);
    return fs.copyAsync(path.join(sourcePath, gameSetting), destPath)
      .catch((err) => {
        switch (copyType) {
          case 'BacGlo':
            // inverted Backup --> Global
            return fs.copyAsync(destPath, path.join(sourcePath, gameSetting));
          case 'ProGlo':
            // inverted Profile --> Global
            return fs.copyAsync(destPath, path.join(sourcePath, gameSetting));
          default:
            // fatal error
            return Promise.reject(err);
        }
      });
  });
}

function checkGlobaFiles(
  oldProfile: types.IProfile,
  newProfile: types.IProfile,
  store: Redux.Store<any>) {

  let missingFiles: string[] = [];
  let fileList: string[] = gameSettingsFiles(oldProfile.gameId,
    mygamesPath(oldProfile.gameId)).concat(gameSettingsFiles(newProfile.gameId,
      mygamesPath(newProfile.gameId)));

  return Promise.map(fileList, (file: string) => {
    return fs.statAsync(file)
      .catch((err) => {
        missingFiles.push(err.path);
      });
  })
    .then(() => {
      if (missingFiles.length > 0) {
        return Promise.reject(missingFiles);
      } else {
        return Promise.resolve(null);
      }
    });
}

function updateLocalGameSettings(
  featureId: string,
  store: Redux.Store<any>,
  oldProfile: types.IProfile,
  newProfile: types.IProfile) {

  let copyFiles: Promise<void[]>;
  if (oldProfile !== null) {
    if (oldProfile.features !== undefined) {
      if (oldProfile.features[featureId]) {
        copyFiles = copyGameSettings(mygamesPath(oldProfile.gameId),
          profilePath(store, oldProfile),
          gameSettingsFiles(oldProfile.gameId, null), store, 'GloPro');
        copyFiles = copyFiles.then(() => copyGameSettings(backupPath(store, oldProfile),
          mygamesPath(oldProfile.gameId),
          gameSettingsFiles(oldProfile.gameId, null), store, 'BacGlo'));
      }
    }
  }

  if (newProfile.features !== undefined) {
    if (newProfile.features[featureId]) {
      copyFiles = copyFiles.then(() => copyGameSettings(mygamesPath(newProfile.gameId),
        backupPath(store, newProfile),
        gameSettingsFiles(newProfile.gameId, null), store, 'GloBac'));
      copyFiles = copyFiles.then(() => copyGameSettings(profilePath(store, newProfile),
        mygamesPath(newProfile.gameId),
        gameSettingsFiles(newProfile.gameId, null), store, 'ProGlo'));
    }
  }

  return Promise.resolve(copyFiles);
}

function init(context): boolean {

  context.registerProfileFeature(
    'local_game_settings', 'boolean', 'cog', 'This profile has its own game settings',
    () => gameSupported(selectors.activeGameId(context.api.store.getState())));

  context.once(() => {
    let store: Redux.Store<types.IState> = context.api.store;

    context.api.onStateChange(['settings', 'profiles', 'activeProfileId'],
      (prev: string, current: string) => {

        checkGlobaFiles(
          prev !== undefined ? store.getState().persistent.profiles[prev] : null,
          store.getState().persistent.profiles[current],
          store)
          .then(() => {
            updateLocalGameSettings(
              'local_game_settings',
              store,
              prev !== undefined ? store.getState().persistent.profiles[prev] : null,
              store.getState().persistent.profiles[current])
              .catch((err) => {
                util.showError(store.dispatch,
                  'An error occured during the profile activation.', err + '\n\n' +
                  'An error occurred copying the profile game settings.\nDuring the copy ' +
                  'we noticed that files that should have been under our control are ' +
                  'inaccessible.\nWe don\'t like unauthorized intrusions. Put your paws down!');
                return false;
              });
          })
          .catch((missingFiles: string[]) => {
            let fileList = missingFiles.map((file) => {
              return file;
            }).join('\n');
            util.showError(store.dispatch, 'An error occured during the profile activation',
              'These files are missing or not writeable: \n' + fileList + '\n\n' +
              'We suggest you to run the game at least one time.');
            return false;
          });
      });

  });
  return true;
}

export default init;
