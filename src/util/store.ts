import reducer, { Decision } from '../reducers/index';
import { IPersistor, PersistingType } from '../types/IExtensionContext';
import { IState } from '../types/IState';

import { DataInvalid } from './CustomErrors';
import { getVisibleWindow, terminate } from './errorHandling';
import ExtensionManager from './ExtensionManager';
import * as fs from './fs';
import { writeFileAtomic } from './fsAtomic';
import { log } from './log';
import ReduxPersistor from './ReduxPersistor';
import {reduxSanity, StateError} from './reduxSanity';

import Promise from 'bluebird';
import { dialog, ipcMain } from 'electron';
import { forwardToRenderer } from 'electron-redux';
import encode from 'encoding-down';
import * as leveldownT from 'leveldown';
import levelup from 'levelup';
import * as _ from 'lodash';
import * as path from 'path';
import * as Redux from 'redux';
import { applyMiddleware, compose, createStore } from 'redux';
import thunkMiddleware from 'redux-thunk';
import getVortexPath from './getVortexPath';

let basePersistor: ReduxPersistor<IState>;

const IMPORTED_TAG = 'imported__do_not_delete.txt';

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

export function finalizeStoreWrite(): Promise<void> {
  if (basePersistor === undefined) {
    return Promise.resolve();
  }
  return basePersistor.finalizeWrite();
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

  const store = createStore<IState, Redux.Action, any, any>(
    reducer([], querySanitize),
    enhancer);
  basePersistor = new ReduxPersistor(store);
  // replayActionMain(store);
  global['getReduxState'] = () => {
    return JSON.stringify(store.getState());
  };

  ipcMain.on('redux-action', (event, payload) => {
    try {
      const action = JSON.parse(payload);
      /*
      if (process.env.NODE_ENV === 'development') {
        log('info', 'forwarded action', payload);
      }
      */
      // TODO: this code is required for redux-batched-actions
      //   we may end up not using this for batched actions in which case this
      //   code is obsolete but not harmful
      if (action?.meta?.batch) {
        // for electron-redux to work, we need each nested action to have the origin
        // meta attribute so that they don't get forwarded back to the renderer they came from
        action.payload.forEach(nestedAction => {
          if (nestedAction.meta === undefined) {
            nestedAction.meta = {};
          }
          nestedAction.meta.origin = action.meta.origin;
        });
      }
      store.dispatch(action);
    } catch (err) {
      log('error', 'failed to forward redux action', payload);
      terminate({
        message: 'Failed to store state change',
        details: err.message,
        stack: err.stack,
        allowReport: true,
        attachLog: true,
      }, store.getState(), true);
    }
  });

  ipcMain.on('get-redux-state', (evt: Electron.IpcMainEvent) => {
    // implicit structured clone algorithm
    evt.returnValue = store.getState();

    /* using explicit json cloning. This was used in an attempt to debug
    mysterious issues transporting initial state between processes but this didn't
    seem to help. Leaving it here in case the situation actually gets worse after
    reverting to implicit serialization

    const dat = JSON.stringify(store.getState());
    const md5 = checksum(Buffer.from(dat));
    evt.returnValue = md5 + dat;
    */
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
    const leveldown: typeof leveldownT = require('leveldown');
    const db = levelup(encode(leveldown(importPath)),
            { keyEncoding: 'utf8', valueEncoding: 'utf8' }, (err: Error) => {
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

  const basePath = path.join(getVortexPath('userData'), 'temp', FULL_BACKUP_PATH);

  const backupFilePath = path.join(basePath, backupName + '.json');

  return fs.ensureDirWritableAsync(basePath, () => Promise.resolve())
    .then(() => writeFileAtomic(backupFilePath,
      serialized))
    .then(() => {
      log('info', 'state backup created', { ms: Date.now() - before, size: serialized.length });
      return backupFilePath;
    });
}
