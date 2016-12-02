import reducer from '../reducers/index';
import { IPersistor } from '../types/IExtensionContext';
import { IState } from '../types/IState';

import {terminate} from './errorHandling';
import ExtensionManager from './ExtensionManager';
import { log } from './log';
import StorageLogger from './StorageLogger';

import * as Promise from 'bluebird';
import * as path from 'path';
import { applyMiddleware, compose, createStore } from 'redux';
import { electronEnhancer } from 'redux-electron-store';
import { autoRehydrate, getStoredState, persistStore } from 'redux-persist';
import { AsyncNodeStorage } from 'redux-persist-node-storage';
import thunkMiddleware from 'redux-thunk';

/*
const logMiddleware = (store) => (next) => (action) => {
  log('debug', 'dispatch', { action });

  let res = next(action);

  return res;
};*/

/**
 * initialize redux store
 * 
 * @export
 * @param {string} basePath
 * @param {ExtensionManager} extensions
 * @returns {Redux.Store<IState>}
 */
export function setupStore(
    basePath: string,
    extensions: ExtensionManager): Promise<Redux.Store<IState>> {
  const middleware = [
    thunkMiddleware,
  ];

  return new Promise<Redux.Store<IState>>((resolve, reject) => {
    const enhancer: Redux.StoreEnhancer<IState> =
        compose(applyMiddleware(...middleware), electronEnhancer(),
                autoRehydrate()) as Redux.StoreEnhancer<IState>;

    const extReducers = extensions.getReducers();

    let result = createStore<IState>(reducer(extReducers), enhancer);
    persistStore(result,
                 {
                   storage: new StorageLogger(
                       new AsyncNodeStorage(path.join(basePath, 'state'))),
                   whitelist: ['window', 'settings', 'persistent', 'account'],
                   debounce: 200,
                   keyPrefix: 'global_',
                 },
                 (err, state) => {
                   if (err !== null) {
                     log('error', 'failed to load application state', {err});
                   }
                   log('info', 'Application state loaded',
                       {state: JSON.stringify(state)});
                   resolve(result);
                 });
  });
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
        let settings = {
          storage: persistor,
          whitelist: [hive],
          debounce: debounce || 200,
          keyPrefix: '',
        };
        // automatically rehydrate
        let internalPersistor = persistStore(store, settings, (err, state) => {
          if (err !== null) {
            reject(err);
          } else {
            log('info', 'External state loaded',
                {hive, state: JSON.stringify(state)});
            // 
            persistor.setResetCallback(() => {
              // when the persistor resets we re-retrieve the stored state
              // and rehydrate with that.
              getStoredState(settings, (innerErr, innerState) => {
                if (innerErr !== null) {
                  terminate({
                    message: 'Failed to reload state',
                    details: innerErr.message,
                  });
                } else {
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
