/**
 * entry point for the renderer process(es)
 */

import 'source-map-support/register';

import reducer from './reducers/index';
import { ITermination, terminate } from './util/errorHandling';
import ExtensionManager from './util/ExtensionManager';
import { ExtensionProvider } from './util/ExtensionProvider';
import GlobalNotifications from './util/GlobalNotifications';
import getI18n from './util/i18n';
import loadExtensionCSS from './util/loadExtensionCSS';
import { log } from './util/log';
import { initApplicationMenu } from './util/menu';
import { showError } from './util/message';
import MainWindow from './views/MainWindow';

import * as Promise from 'bluebird';
import { ipcRenderer } from 'electron';
import { EventEmitter } from 'events';
import { changeLanguage } from 'i18next';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
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
  const DevTools = require('./util/DevTools').default;
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

extensions.doOnce();
initApplicationMenu(extensions);

loadExtensionCSS(extensions);

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

process.on('uncaughtException', (error) => {
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

// prevent the page from being changed through drag&drop
document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault();
};
