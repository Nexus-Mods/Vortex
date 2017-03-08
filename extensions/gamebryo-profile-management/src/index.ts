import { backupPath, gameSupported, iniFiles, mygamesPath, profilePath } from './util/gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { log, selectors, types } from 'nmm-api';
import * as path from 'path';

let oldProfile: types.IProfile;
let newProfile: types.IProfile;
let oldLocalGameSettings: boolean = false;
let newLocalGameSettings: boolean = false;

function copyIniFiles(
  destinationPath: string,
  sourcePath: string,
  iniFiles: string[],
  store: any): Promise<void[]> {

  return fs.ensureDirAsync(sourcePath)
    .then(() => {
      return Promise.map(iniFiles, (filePath: string) => {
        let destPath = path.join(destinationPath, path.basename(filePath));
        console.log('copying ' + path.join(sourcePath, filePath) + ' to ' + destPath);
       /* return fs.copyAsync(path.join(sourcePath, filePath), destPath)
          .catch((err) => {
            util.showError(store.dispatch, 'An error occurred copying the profile INIs', err);
          });*/
      });
    });
}

function updateLocalGameSettings(featureId: string, store: Redux.Store<any>): Promise<void> {

  if (oldProfile.features !== undefined) {
    oldLocalGameSettings = oldProfile.features[featureId];
  }
  if (newProfile.features !== undefined) {
    newLocalGameSettings = newProfile.features[featureId];
  }

  if (oldLocalGameSettings) {
    copyIniFiles(profilePath(store, oldProfile),
      mygamesPath(oldProfile.gameId), iniFiles(oldProfile.gameId), store)
      .then(() => {
        copyIniFiles(mygamesPath(oldProfile.gameId),
          backupPath(store, oldProfile), iniFiles(oldProfile.gameId), store)
          .then(() => {
            if (newLocalGameSettings) {
              copyIniFiles(backupPath(store, newProfile),
                mygamesPath(newProfile.gameId), iniFiles(newProfile.gameId), store)
                .then(() => {
                  copyIniFiles(mygamesPath(newProfile.gameId),
                    profilePath(store, newProfile), iniFiles(newProfile.gameId), store)
                    .then(() => {
                      log('info', 'Profiles game settings copy complete');
                    });
                });
            }
          });
      });
  }
  return null;
}

function init(context): boolean {

 context.registerProfileFeature(
    'local_game_settings', 'boolean', 'cog', 'This profile has its own game settings',
    () => gameSupported(selectors.activeGameId(context.api.store.getState())));

 context.once(() => {
 let store: Redux.Store<types.IState> = context.api.store;

 context.api.onStateChange(['settings', 'profiles', 'activeProfileId'],
      (prev: string, current: string) => {

       oldProfile = store.getState().persistent.profiles[prev];
       newProfile = store.getState().persistent.profiles[current];
       updateLocalGameSettings('local_game_settings', store);
      });
 });
 return true;
}

export default init;
