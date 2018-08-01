import getDownloadPath from '../extensions/download_management/util/getDownloadPath';
import resolvePath, { pathDefaults } from '../extensions/mod_management/util/resolvePath';
import { IState } from '../types/IState';

import { setDownloadPath, setInstallPath, showDialog } from '../actions';
import * as fs from '../util/fs';
import makeCI from '../util/makeCaseInsensitive';

import { UserCanceled } from './CustomErrors';
import { log } from './log';

import * as Promise from 'bluebird';
import { dialog } from 'electron';
import * as path from 'path';
import * as semver from 'semver';
import * as format from 'string-template';

interface IMigration {
  minVersion: string;
  maySkip: boolean;
  doQuery: boolean;
  description: string;
  apply: (store: Redux.Store<IState>) => Promise<void>;
}

function selectDirectory(defaultPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dialog.showOpenDialog(null, {
      title: 'Select empty directory to store downloads',
      properties: [ 'openDirectory', 'createDirectory', 'promptToCreate' ],
      defaultPath: getDownloadPath(defaultPath, undefined),
    }, (filePaths: string[]) => {
      if ((filePaths === undefined) || (filePaths.length === 0)) {
        return reject(new UserCanceled());
      }
      return fs.readdirAsync(filePaths[0]).then(files => {
        if (files.length > 0) {
          dialog.showErrorBox('Invalid path selected',
            'The directory needs to be empty');
          selectDirectory(defaultPath).then(resolve);
        } else {
          resolve(filePaths[0]);
        }
      });
    });
  });
}

function transferPath(from: string, to: string): Promise<void> {
  return Promise.join(fs.statAsync(from), fs.statAsync(to),
      (statOld: fs.Stats, statNew: fs.Stats) => Promise.resolve(statOld.dev === statNew.dev))
    .then((sameVolume: boolean) => {
      const func = sameVolume ? fs.renameAsync : fs.copyAsync;
      return fs.readdirAsync(from)
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

function moveDownloads_0_16(store: Redux.Store<IState>): Promise<void> {
  const state = store.getState();
  log('info', 'importing downloads from pre-0.16.0 version');
  return selectDirectory(state.settings.downloads.path)
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

function updateInstallPath_0_16(store: Redux.Store<IState>): Promise<void> {
  const state = store.getState();
  const { paths } = (state.settings.mods as any);
  return Promise.map(Object.keys(paths), gameId => {
    const base = resolvePath('base', paths, gameId);
    log('info', 'set install path',
        format(paths[gameId].install || pathDefaults.install, { base }));
    store.dispatch(setInstallPath(
      gameId, format(paths[gameId].install || pathDefaults.install, makeCI({ base }))));
  })
  .then(() => null);
}

const migrations: IMigration[] = [
  {
    minVersion: '0.16.0',
    maySkip: true,
    doQuery: true,
    description: 'The directory structure for downloads was changed so we need to move them. '
                + 'You can skip this step but then all downloads will disappear from your '
                + 'download list. Please note: there will be no progress indication, please '
                + 'be patient.',
    apply: moveDownloads_0_16,
  },
  {
    minVersion: '0.16.0',
    maySkip: false,
    doQuery: false,
    description: 'install path is now in a different spot of the store',
    apply: updateInstallPath_0_16,
  },
];

function queryMigration(migration: IMigration): Promise<boolean> {
  if (!migration.doQuery) {
    return Promise.resolve(true);
  }
  return new Promise((resolve, reject) => {
    const buttons = migration.maySkip
      ? ['Cancel', 'Skip', 'Continue']
      : ['Cancel', 'Continue'];
    dialog.showMessageBox(null, {
      type: 'info',
      buttons,
      title: 'Migration neccessary',
      message: migration.description,
      noLink: true,
    }, (response: number) => {
      if (buttons[response] === 'Cancel') {
        return reject(new UserCanceled());
      }
      return resolve(buttons[response] === 'Continue');
    });
  });
}

function migrate(store: Redux.Store<IState>): Promise<void> {
  const state = store.getState();
  const oldVersion = state.app.appVersion || '0.0.0';
  const neccessaryMigrations = migrations.filter(mig => semver.lt(oldVersion, mig.minVersion));
  return Promise.each(neccessaryMigrations, migration =>
      queryMigration(migration)
        .then((proceed: boolean) => proceed ? migration.apply(store) : Promise.resolve()))
    .then(() => null);
}

export default migrate;
