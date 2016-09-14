/**
 * entry point for the renderer process(es)
 */

import 'source-map-support/register';

import reducer from './reducers/index';
import { IExtensionInit } from './types/Extension';
import loadExtensions from './util/ExtensionLoader';
import { ExtensionProvider, getReducers } from './util/ExtensionProvider';
import getI18n from './util/i18n';
import { log } from './util/log';
import MainWindow from './views/MainWindow';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { I18nextProvider } from 'react-i18next';
import { Provider } from 'react-redux';
import { Store, applyMiddleware, compose, createStore } from 'redux';
import { electronEnhancer } from 'redux-electron-store';

log('info', 'renderer process started');

// set up store. Through the electronEnhancer this is automatically
// synchronized with the main process store

let filter = {
};

let middleware = [];

let enhancer = null;

if (process.env.NODE_ENV === 'development') {
  // tslint:disable-next-line:no-var-requires
  const DevTools = require('./util/DevTools');
  enhancer = compose(
    applyMiddleware(...middleware),
    electronEnhancer({ filter }),
    DevTools.instrument()
  );
} else {
  enhancer = compose(
    applyMiddleware(...middleware),
    electronEnhancer({ filter })
  );
}

const extensions: IExtensionInit[] = loadExtensions();

let extReducers = getReducers(extensions);

const store: Store<any> = createStore(reducer(extReducers), enhancer);

const { remote } = require('electron');
log('info', 'renderer connected to store');
console.log(`using ${remote.app.getPath('userData')} as the storage directory`);
console.log(`what about ${remote.app.getPath('appData')}`);

const i18n = getI18n(store.getState().settings.interface.language);

// render the page content 

ReactDOM.render(
  <Provider store={store}>
    <I18nextProvider i18n={i18n}>
      <ExtensionProvider extensions={extensions}>
        <MainWindow className='full-height'/>
      </ExtensionProvider>
    </I18nextProvider>
  </Provider>,
  document.getElementById('content')
);
