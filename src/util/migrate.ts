import getDownloadPath from '../extensions/download_management/util/getDownloadPath';
import resolvePath, { pathDefaults } from '../extensions/mod_management/util/resolvePath';
import { IState } from '../types/IState';

import { clearOAuthCredentials, completeMigration, setForcedLogout, setDownloadPath, setInstallPath, setUserAPIKey, setUserInfo } from '../actions';
import * as fs from '../util/fs';
import makeCI from '../util/makeCaseInsensitive';

import { UserCanceled } from './CustomErrors';
import { log } from './log';

import Promise from 'bluebird';
import { BrowserWindow, MessageBoxOptions, dialog } from 'electron';
import * as path from 'path';
import * as Redux from 'redux';
import * as semver from 'semver';
import format from 'string-template';
import { reinterpretUntilZeros } from 'ref';

interface IMigration {
  id: string;
  minVersion: string;
  maySkip: boolean;
  doQuery: boolean;
  description: string;
  apply: (window: BrowserWindow, store: Redux.Store<IState>) => Promise<void>;
}

function selectDirectory(window: BrowserWindow, defaultPathPattern: string): Promise<string> {
  const defaultPath = getDownloadPath(defaultPathPattern, undefined);
  return fs.ensureDirWritableAsync(defaultPath, () => Promise.resolve())
    .then(() => dialog.showOpenDialog(window, {
        title: 'Select empty directory to store downloads',
        properties: [ 'openDirectory', 'createDirectory', 'promptToCreate' ],
        defaultPath,
      }))
    .then(result => {
      const { filePaths } = result;
      if ((filePaths === undefined) || (filePaths.length === 0)) {
        return Promise.reject(new UserCanceled());
      }
      return fs.readdirAsync(filePaths[0])
        .catch(err => err.code === 'ENOENT'
          ? fs.ensureDirWritableAsync(filePaths[0], () => Promise.resolve()).then(() => [])
          : Promise.reject(err))
        .then(files => {
          if (files.length > 0) {
            dialog.showErrorBox('Invalid path selected',
              'The directory needs to be empty');
            return selectDirectory(window, defaultPathPattern);
          } else {
            return Promise.resolve(filePaths[0]);
          }
        });
    });
}

function transferPath(from: string, to: string): Promise<void> {
  return Promise.join(fs.statAsync(from), fs.statAsync(to),
      (statOld: fs.Stats, statNew: fs.Stats) => Promise.resolve(statOld.dev === statNew.dev))
    .then((sameVolume: boolean) => {
      const func = sameVolume ? fs.renameAsync : fs.copyAsync;
      return Promise.resolve(fs.readdirAsync(from))
        .map((fileName: string) =>
          func(path.join(from, fileName), path.join(to, fileName))
          .catch(err => (err.code === 'EXDEV')
              // EXDEV implies we tried to rename when source and destination are
              // not in fact on the same volume. This is what comparing the stat.dev
              // was supposed to prevent.
              ? fs.copyAsync(path.join(from, fileName), path.join(to, fileName))
              : Promise.reject(err)))
        .then(() => fs.removeAsync(from));
    })
    .catch(err => (err.code === 'ENOENT')
      ? Promise.resolve()
      : Promise.reject(err));
}

function dialogProm(window: BrowserWindow, type: string, title: string,
                    message: string, options: string[]): Promise<string> {
  return Promise.resolve(dialog.showMessageBox(window, {
      type: type as ('none' | 'info' | 'error' | 'question' | 'warning'),
      buttons: options,
      title,
      message,
      noLink: true,
    })).then(result => options[result.response]);
}

function forceLogoutForOauth_1_9(window: BrowserWindow, store: Redux.Store<IState>): Promise<void> {
  const state = store.getState();

  const apiKey = state.confidential.account?.['nexus']?.['APIKey'];
  const oauthCred = state.confidential.account?.['nexus']?.['OAuthCredentials'];

  const loggedIn = (apiKey !== undefined) || (oauthCred !== undefined);

  log('info', 'forceLogoutForOauth_1_9() migration function for pre-oauth (1.9) versions', { 
    apiKey: apiKey, 
    oauthCred: oauthCred, 
    loggedIn: loggedIn});  

  // we only care about forcing re-authing if they are logged in already
  if(!loggedIn) {
    log('warn', 'forceLogoutForOauth_1_9() not logged in so skipping migration');
    return;    
  }

  // this is going to force a logout and set the ForceLogout flag in the state so that the nexus_integration extension can pick up the change
  store.dispatch(setUserAPIKey(undefined));
  store.dispatch(clearOAuthCredentials(null)) 
  store.dispatch(setUserInfo(undefined));
  store.dispatch(setForcedLogout(true));

  log('info', 'forceLogoutForOauth_1_9() should be logged out');

  return;
}


function moveDownloads_0_16(window: BrowserWindow, store: Redux.Store<IState>): Promise<void> {
  const state = store.getState();
  log('info', 'importing downloads from pre-0.16.0 version');
  return dialogProm(window,
                    'info', 'Moving Downloads',
                    'On the next screen, please select an empty directory where all your '
                    + 'downloads from vortex (for all games) will be placed',
                    ['Next'])
    .then(() => selectDirectory(window, state.settings.downloads.path))
    .then(downloadPath => {
      store.dispatch(setDownloadPath(downloadPath));
      return Promise.map(Object.keys(state.settings.gameMode.discovered),
        gameId => {
          const resolvedPath = path.join(downloadPath, gameId);
          return fs.ensureDirAsync(resolvedPath)
            .then(() => transferPath(
              resolvePath('download', (state.settings.mods as any).paths, gameId),
              resolvedPath));
        })
        .then(() => null);
    });
}

function updateInstallPath_0_16(window: BrowserWindow, store: Redux.Store<IState>): Promise<void> {
  const state = store.getState();
  const { paths } = (state.settings.mods as any);
  return Promise.map(Object.keys(paths || {}), gameId => {
    const base = resolvePath('base', paths, gameId);
    log('info', 'set install path',
        format(paths[gameId].install || pathDefaults.install, { base }));
    store.dispatch(setInstallPath(
      gameId, format(paths[gameId].install || pathDefaults.install, makeCI({
        base,
        game: '{GAME}',
        userData: '{USERDATA}',
      }))));
    return Promise.resolve();
  })
  .then(() => null);
}

const migrations: IMigration[] = [
  {
    id: 'move-downloads-0.16',
    minVersion: '0.16.0',
    maySkip: false,
    doQuery: true,
    description: 'The directory structure for downloads was changed so we need to move them. '
                + 'Please note: there will be no progress indication, please be patient.',
    apply: moveDownloads_0_16,
  },
  {
    id: 'update-install-path-0.16',
    minVersion: '0.16.0',
    maySkip: false,
    doQuery: false,
    description: 'install path is now in a different spot of the store',
    apply: updateInstallPath_0_16,
  },
  {
    id: 'forceLogoutForOauth_1_9',
    minVersion: '1.9.0',
    maySkip: false,
    doQuery: false,
    description: 'forcing logout for anything pre-oauth, and deprecating apikey logins',
    apply: forceLogoutForOauth_1_9,
  },
];

function queryMigration(window: BrowserWindow, migration: IMigration): Promise<boolean> {
  if (!migration.doQuery) {
    return Promise.resolve(true);
  }
  return new Promise((resolve, reject) => {
    const buttons = migration.maySkip
      ? ['Cancel', 'Skip', 'Continue']
      : ['Cancel', 'Continue'];
    dialog.showMessageBox(window, {
      type: 'info',
      buttons,
      title: 'Migration neccessary',
      message: migration.description,
      noLink: true,
    }).then(result => {
      if (buttons[result.response] === 'Cancel') {
        return reject(new UserCanceled());
      }
      return resolve(buttons[result.response] === 'Continue');
    });
  });
}

function queryContinue(window: BrowserWindow, err: Error): Promise<void> {
  return dialogProm(window,
    'error',
    'Migration failed',
    'A migration step failed. You should quit now and resolve the cause of the issue.\n'
    + err.stack || err.message,
    ['Ignore', 'Quit'],
  )
  .then(selection => selection === 'Ignore'
    ? Promise.resolve()
    : Promise.reject(err));
}

function migrate(store: Redux.Store<IState>, window: BrowserWindow): Promise<void> {
  const state = store.getState();
  const oldVersion = state.app.appVersion || '0.0.0';
  const neccessaryMigrations = migrations
    .filter(mig => semver.lt(oldVersion, mig.minVersion))
    .filter(mig => state.app.migrations.indexOf(mig.id) === -1);
  return Promise.each(neccessaryMigrations, migration =>
      queryMigration(window, migration)
        .then((proceed: boolean) => proceed ? migration.apply(window, store) : Promise.resolve())
        .then(() => {
          store.dispatch(completeMigration(migration.id));
          return Promise.resolve();
        })
        .catch(err => !(err instanceof UserCanceled), (err: Error) => queryContinue(window, err)))
    .then(() => null);
}

export default migrate;
