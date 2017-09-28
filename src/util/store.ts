import reducer from '../reducers/index';
import {IExtensionReducer} from '../types/Extension';
import { IPersistor, PersistingType } from '../types/IExtensionContext';
import { IState } from '../types/IState';
import { IStorage } from '../types/IStorage';

import {terminate} from './errorHandling';
import ExtensionManager from './ExtensionManager';
import LevelStorage from './LevelStorage';
import { log } from './log';
import {reduxSanity, StateError} from './reduxSanity';
import StorageLogger from './StorageLogger';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';
import * as Redux from 'redux';
import { applyMiddleware, compose, createStore } from 'redux';
import { electronEnhancer } from 'redux-electron-store';
import {
  createPersistor,
  getStoredState,
  Persistor,
  persistStore,
} from 'redux-persist';
import {AsyncNodeStorage} from 'redux-persist-node-storage';
import thunkMiddleware from 'redux-thunk';

/*
const logMiddleware = store => next => action => {
  log('debug', 'dispatch', { action });

  let res = next(action);

  return res;
};*/

const storage: { [path: string]: IStorage } = {};

export function createVortexStore(sanityCallback: (err: StateError) => void): Redux.Store<IState> {
  const middleware = [
    thunkMiddleware,
    reduxSanity(sanityCallback),
  ];

  const enhancer: Redux.StoreEnhancer<IState> =
      compose(applyMiddleware(...middleware),
              electronEnhancer()) as Redux.StoreEnhancer<any>;

  return createStore<IState>(reducer([]), enhancer);
}

function initStorage(basePath: string): Promise<IStorage> {
  if (storage[basePath] !== undefined) {
    return Promise.resolve(storage[basePath]);
  }

  return LevelStorage.create(basePath, 'state')
      .then((levelStorage) => {
        // storage[basePath] = new StorageLogger(levelStorage);
        storage[basePath] = levelStorage;
        return storage[basePath];
      });
}

function persist(store: Redux.Store<IState>, levelStorage: IStorage,
                 whitelist: string[]): Promise<Persistor> {
  const settings = {
    storage: levelStorage,
    whitelist,
    debounce: 200,
    keyPrefix: 'global_',
  };

  return new Promise<Persistor>((resolve, reject) => {
    const persistor = createPersistor(store, settings);
    getStoredState(settings, (err, state) => {
      if (err !== null) {
        const app = appIn || remote.app;
        // TODO: useless error message but why should the leveldb be
        //   broken?
        terminate({
          message: 'Failed to load application state.',
          details: 'The application state file is damaged.',
          stack: err.stack,
        });
        return reject(err);
      }
      persistor.rehydrate(state);
      resolve(persistor);
    });
  });
}

export function syncStore(
    store: Redux.Store<IState>,
    basePath: string, whitelist: string[]): Promise<Persistor> {
  return initStorage(basePath)
      .then(levelStorage => persist(store, levelStorage, whitelist));
}

export function allHives(extensions: ExtensionManager): string[] {
  const whitelist = ['app', 'settings', 'persistent', 'confidential'];
  extensions.apply('registerSettingsHive',
                   (hive: string, type: PersistingType) => {
                     if (type === 'global') {
                       whitelist.push(hive);
                     }
                   });
  return whitelist;
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
    queue = queue.then(() => {
      return new Promise<void>((resolve, reject) => {
        // persistor settings
        const settings = {
          storage: persistor,
          whitelist: [hive],
          debounce: debounce || 200,
          keyPrefix: '',
        };
        // automatically rehydrate
        const internalPersistor = persistStore(store, settings, (err, state) => {
          if (err !== null) {
            return reject(err);
          } else {
            log('info', 'External state loaded',
                {hive, state: JSON.stringify(state)});

            persistor.setResetCallback(() => {
              log('debug', 'persistor reset', hive);
              // when the persistor resets we re-retrieve the stored state
              // and rehydrate with that.
              getStoredState(settings, (innerErr, innerState) => {
                if (innerErr !== null) {
                  terminate({
                    message: 'Failed to reload state',
                    details: innerErr.message,
                  });
                  return reject(innerErr);
                } else {
                  // TODO: this seems to cause the state to be applied twice.
                  //   not a big deal but curious
                  internalPersistor.rehydrate(innerState);
                }
              });
            });
            resolve(state);
          }
        });
      });
    });
  });
  return queue;
}
