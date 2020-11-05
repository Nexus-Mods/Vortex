import reducer, { Decision } from '../reducers/index';
import { IPersistor, PersistingType } from '../types/IExtensionContext';
import { IState } from '../types/IState';

import { DataInvalid } from './CustomErrors';
import { getVisibleWindow, terminate } from './errorHandling';
import ExtensionManager from './ExtensionManager';
import * as fs from './fs';
import { checksum, writeFileAtomic } from './fsAtomic';
import { log } from './log';
import ReduxPersistor from './ReduxPersistor';
import {reduxSanity, StateError} from './reduxSanity';

import Promise from 'bluebird';
import { app as appIn, dialog, ipcMain, remote } from 'electron';
import { forwardToRenderer, replayActionMain } from 'electron-redux';
import * as encode from 'encoding-down';
import * as leveldown from 'leveldown';
import * as levelup from 'levelup';
import * as _ from 'lodash';
import * as path from 'path';
import * as Redux from 'redux';
import { applyMiddleware, compose, createStore } from 'redux';
import thunkMiddleware from 'redux-thunk';

let basePersistor: ReduxPersistor<IState>;

const IMPORTED_TAG = 'imported__do_not_delete.txt';

const app = remote !== undefined ? remote.app : appIn;

export const currentStatePath = 'state.v2';
export const FULL_BACKUP_PATH = 'state_backups_full';

export function querySanitize(errors: string[]): Decision {
  const response = dialog.showMessageBoxSync(getVisibleWindow(), {
    message:
        'Application state is invalid. I can try to repair it but you may lose data.',
    detail: errors.join('\n'),
    buttons: ['Quit', 'Ignore', 'Backup and Repair'],
  });

  return [Decision.QUIT, Decision.IGNORE, Decision.SANITIZE][response];
}

export function createVortexStore(sanityCallback: (err: StateError) => void): Redux.Store<IState> {
  const middleware = [
    thunkMiddleware,
    reduxSanity(sanityCallback),
  ];

  const enhancer: Redux.StoreEnhancer<IState> =
      compose(applyMiddleware(
          ...middleware,
          forwardToRenderer,
        )) as Redux.StoreEnhancer<any>;

  const store = createStore<IState, Redux.Action, any, any>(reducer([], querySanitize), enhancer);
  basePersistor = new ReduxPersistor(store);
  // replayActionMain(store);
  global['getReduxState'] = () => {
    return JSON.stringify(store.getState());
  };

  ipcMain.on('redux-action', (event, payload) => {
    try {
      store.dispatch(JSON.parse(payload));
    } catch (err) {
      log('error', 'failed to forward redux action', payload);
      terminate({
        message: 'Failed to store state change',
        details: err.message,
        allowReport: true,
        attachLog: true,
      }, store.getState(), true);
    }
  });

  ipcMain.on('get-redux-state', (evt: Electron.IpcMainEvent) => {
    const dat = JSON.stringify(store.getState());
    const md5 = checksum(Buffer.from(dat));
    evt.returnValue = md5 + dat;
  });
  return store;
}

export function insertPersistor(hive: string, persistor: IPersistor): Promise<void> {
  return basePersistor.insertPersistor(hive, persistor);
}

export function allHives(extensions: ExtensionManager): string[] {
  const hives = ['settings', 'persistent', 'confidential'];
  extensions.apply('registerSettingsHive',
                   (hive: string, type: PersistingType) => {
                     if (type === 'global') {
                       hives.push(hive);
                     }
                   });
  return hives;
}

/**
 * apply the registerPersistor extensions to this store
 *
 * @export
 * @param {Redux.Store<IState>} store
 * @param {ExtensionManager} extensions
 * @returns {Promise<void>}
 */
export function extendStore(store: Redux.Store<IState>,
                            extensions: ExtensionManager): Promise<void> {
  let queue = Promise.resolve();
  extensions.apply('registerPersistor', (hive: string, persistor: IPersistor,
                                         debounce?: number) => {
    queue = queue.then(() => insertPersistor(hive, persistor));
  });
  return queue;
}

function importStateV1(importPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    (levelup as any)(encode(leveldown(importPath)),
                     { keyEncoding: 'utf8', valueEncoding: 'utf8' }, (err, db) => {
      if (err !== null) {
        log('info', 'failed to open db', err);
        reject(err);
      } else {
        const res = {};
        db.createReadStream()
          .on('data', data => {
            if (data.key.startsWith('global_')) {
              res[data.key.substr(7)] = JSON.parse(data.value);
            }
          })
          .on('error', error => {
            reject(error);
          })
          .on('end', () => {
            resolve(res);
          });
      }
    });
  });
}

function exists(filePath: string): boolean {
  try {
    fs.statSync(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    } else {
      throw err;
    }
  }
}

export function markImported(basePath: string): Promise<void> {
  return fs.writeFileAsync(
      path.join(basePath, currentStatePath, IMPORTED_TAG), '')
    .then(() => null);
}

export function importState(basePath: string): Promise<any> {
  if (exists(path.join(basePath, currentStatePath, IMPORTED_TAG))) {
    return Promise.resolve();
  }

  const versionDirs = [
    { path: path.join(basePath, 'state'), func: importStateV1 },
  ];

  // find the newest previous version to import from
  const importVer = versionDirs.find(ver => exists(ver.path));

  return ((importVer !== undefined) && (importVer.func !== null))
    // read and transform data to import
    ? importVer.func(importVer.path)
    : Promise.resolve();
}

export function createFullStateBackup(backupName: string,
                                      store: Redux.Store<any>)
                                      : Promise<string> {
  const before = Date.now();
  // not backing up confidential, session or extension persistors
  const state = _.pick(store.getState(), ['settings', 'persistent', 'app', 'user']);
  let serialized;
  try {
    serialized = JSON.stringify(state, undefined, 2);
  } catch (err) {
    log('error', 'Failed to create state backup', err.message);
    return Promise.reject(new DataInvalid('Failed to create state backup'));
  }

  const basePath = path.join(app.getPath('userData'), 'temp', FULL_BACKUP_PATH);

  const backupFilePath = path.join(basePath, backupName + '.json');

  return fs.ensureDirWritableAsync(basePath, () => Promise.resolve())
    .then(() => writeFileAtomic(backupFilePath,
      serialized))
    .then(() => {
      log('info', 'state backup created', { ms: Date.now() - before, size: serialized.length });
      return backupFilePath;
    });
}
