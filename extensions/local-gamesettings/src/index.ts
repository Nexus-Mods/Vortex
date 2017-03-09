import { backupPath, gameSupported, iniFiles, mygamesPath, profilePath } from './util/gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types, util } from 'nmm-api';
import * as path from 'path';

function copyIniFiles(
  destinationPath: string,
  sourcePath: string,
  iniFiles: string[],
  store: any): Promise<void[]> {

  return Promise.map(iniFiles, (filePath: string) => {
    let destPath = path.join(destinationPath, path.basename(filePath));
    // console.log('copying ' + path.join(sourcePath, filePath) + ' to ' + destPath);
    return fs.copyAsync(path.join(sourcePath, filePath), destPath)
       .catch((err) => {
         util.showError(store.dispatch, 'An error occurred copying the profile INIs', err);
       });
  });
}

function updateLocalGameSettings(
  featureId: string,
  store: Redux.Store<any>,
  oldProfile: types.IProfile,
  newProfile: types.IProfile): Promise<void[]> {

  let copyFiles: Promise<void[]>;
  if (oldProfile !== null) {
    if (oldProfile.features !== undefined) {
      if (oldProfile.features[featureId]) {
        copyFiles = copyIniFiles(profilePath(store, oldProfile),
          mygamesPath(oldProfile.gameId), iniFiles(oldProfile.gameId), store);
        copyFiles = copyFiles.then(() => copyIniFiles(mygamesPath(oldProfile.gameId),
          backupPath(store, oldProfile), iniFiles(oldProfile.gameId), store));
      }
    }
  }

  if (newProfile.features !== undefined) {
    if (newProfile.features[featureId]) {
      copyFiles = copyIniFiles(backupPath(store, newProfile),
        mygamesPath(newProfile.gameId), iniFiles(newProfile.gameId), store);
      copyFiles = copyFiles.then(() => copyIniFiles(mygamesPath(newProfile.gameId),
        profilePath(store, newProfile), iniFiles(newProfile.gameId), store));
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

        updateLocalGameSettings(
          'local_game_settings',
          store,
          prev !== undefined ? store.getState().persistent.profiles[prev] : null,
          store.getState().persistent.profiles[current]);
      });
  });
  return true;
}

export default init;
