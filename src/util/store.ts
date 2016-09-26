import reducer from '../reducers/index';
import { IState } from '../types/IState';

import ExtensionManager from './ExtensionLoader';
import { log } from './log';
import StorageLogger from './StorageLogger';

import * as path from 'path';
import { applyMiddleware, compose, createStore } from 'redux';
import { electronEnhancer } from 'redux-electron-store';
import { autoRehydrate, persistStore } from 'redux-persist';
import { AsyncNodeStorage } from 'redux-persist-node-storage';
import thunkMiddleware from 'redux-thunk';

const logMiddleware = store => next => action => {
  log('debug', 'dispatch', { action });
  return next(action);
};

export function setupStore(basePath: string, extensions: ExtensionManager): Redux.Store<IState> {
  const middleware = [
    thunkMiddleware,
    logMiddleware,
  ];

  const enhancer: Redux.StoreEnhancer<IState> = compose(
    applyMiddleware(...middleware),
    electronEnhancer(),
    autoRehydrate()
  ) as Redux.StoreEnhancer<IState>;

  const extReducers = extensions.getReducers();

  let result = createStore<IState>(reducer(extReducers), enhancer);
  persistStore(result, {
    storage: new StorageLogger(new AsyncNodeStorage(path.join(basePath, 'state'))),
    whitelist: ['window', 'settings', 'account'],
    debounce: 200,
    keyPrefix: 'global_',
  },
    (err, state) => {
      if (err !== null) {
        log('error', 'failed to load application state', { err });
      }
      log('info', 'Application state loaded', { state: JSON.stringify(state) });
    }
  );

  return result;
}
