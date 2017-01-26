/**
 * entry point for the renderer process(es)
 */

import 'source-map-support/register';

import * as ReactDOM from 'react-dom';

if (process.env.NODE_ENV === 'production') {
  // TODO the following hacks should, supposedly increase react
  //  performance by avoiding unnecessary "if (process.env.NODE_ENV === )" 
  //  calls and speeding up the rest by turning process.env into a static
  //  object.
  //  I have not yet made any benchmarks to verify that
  // tslint:disable-next-line:no-var-requires
  require('react/dist/react.min.js');
  require.cache[require.resolve('react')] =
    require.cache[require.resolve('react/dist/react.min.js')];

  process.env = JSON.parse(JSON.stringify(process.env));
}

import reducer from './reducers/index';
import DevToolsType from './util/DevTools';
import { ITermination, terminate } from './util/errorHandling';
import ExtensionManager from './util/ExtensionManager';
import { ExtensionProvider } from './util/ExtensionProvider';
import GlobalNotifications from './util/GlobalNotifications';
import getI18n from './util/i18n';
import loadExtensionCSS from './util/loadExtensionCSS';
import { log } from './util/log';
import { initApplicationMenu } from './util/menu';
import { showError } from './util/message';
import {extendStore} from './util/store';
import MainWindow from './views/MainWindow';

import * as Promise from 'bluebird';
import { ipcRenderer } from 'electron';
import { EventEmitter } from 'events';
import { changeLanguage } from 'i18next';
import * as React from 'react';
import { I18nextProvider } from 'react-i18next';
import { Provider } from 'react-redux';
import { Store, applyMiddleware, compose, createStore } from 'redux';
import { electronEnhancer } from 'redux-electron-store';
import thunkMiddleware from 'redux-thunk';

log('debug', 'renderer process started');

// allow promises to be cancelled.
Promise.config({ cancellation: true });

// set up store. Through the electronEnhancer this is automatically
// synchronized with the main process store

let filter = true;
let middleware = [
  thunkMiddleware,
];

let enhancer = null;

if (process.env.NODE_ENV === 'development') {
  // tslint:disable-next-line:no-var-requires
  const DevTools: typeof DevToolsType = require('./util/DevTools').default;
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

process.on('xuncaughtException', (error) => {
  let details: ITermination = undefined;

  switch (typeof error) {
    case 'object': {
      details = { message: error.message, details: error.stack };
    } break;
    case 'string': {
      details = { message: error };
    } break;
    default: {
      details = { message: error };
    } break;
  }

  terminate(details);
});

const eventEmitter: NodeJS.EventEmitter = new EventEmitter();

const extensions: ExtensionManager = new ExtensionManager(eventEmitter);
let extReducers = extensions.getReducers();

const store: Store<any> = createStore(reducer(extReducers), enhancer);
extensions.setStore(store);
extensions.applyExtensionsOfExtensions();
log('debug', 'renderer connected to store');

// tslint:disable-next-line:no-unused-variable
const globalNotifications = new GlobalNotifications(extensions.getApi());

ipcRenderer.on('external-url', (event, protocol, url) => {
  let handler = extensions.getProtocolHandler(protocol);
  if (handler !== null) {
    handler(url);
  } else {
    log('warn', 'not handling url, unknown protocol', { url });
  }
});

let currentLanguage: string = store.getState().settings.interface.language;
store.subscribe(() => {
  let newLanguage: string = store.getState().settings.interface.language;
  if (newLanguage !== currentLanguage) {
    currentLanguage = newLanguage;
    changeLanguage(newLanguage, (err, t) => {
      if (err !== undefined) {
        showError(store.dispatch, 'failed to activate language', err);
      }
    });
  }
});

const i18n = getI18n(store.getState().settings.interface.language);

extensions.setTranslation(i18n);

extendStore(store, extensions)
  .then(() => {
    extensions.doOnce();
    initApplicationMenu(extensions);
    loadExtensionCSS(extensions);
    // render the page content 
    ReactDOM.render(
      <Provider store={store}>
        <I18nextProvider i18n={i18n}>
          <ExtensionProvider extensions={extensions}>
            <MainWindow className='full-height' api={extensions.getApi()} />
          </ExtensionProvider>
        </I18nextProvider>
      </Provider>,
      document.getElementById('content')
    );
  });

// prevent the page from being changed through drag&drop
document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault();
};
