/**
 * entry point for the renderer process(es)
 */

import timeRequire from './util/timeRequire';
let stopTime = timeRequire();

import 'source-map-support/register';

import * as path from 'path';
import * as ReactDOM from 'react-dom';

if (process.env.NODE_ENV === 'production') {
  // TODO: the following hacks should, supposedly increase react
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

process.env.SASS_BINARY_PATH = path.resolve(
  path.dirname(path.dirname(require.resolve('node-sass'))), 'bin',
  `${process.platform}-${process.arch}-${process.versions.modules}`, 'node-sass.node');

import reducer from './reducers/index';
import DevToolsType from './util/DevTools';
import { ITermination, terminate } from './util/errorHandling';
import ExtensionManager from './util/ExtensionManager';
import { ExtensionProvider } from './util/ExtensionProvider';
import GlobalNotifications from './util/GlobalNotifications';
import getI18n from './util/i18n';
import { log } from './util/log';
import { initApplicationMenu } from './util/menu';
import { showError } from './util/message';
import {extendStore} from './util/store';
import MainWindow from './views/MainWindow';

import * as Promise from 'bluebird';
import { crashReporter, ipcRenderer, remote } from 'electron';
import { EventEmitter } from 'events';
import { changeLanguage } from 'i18next';
import * as React from 'react';
import { I18nextProvider } from 'react-i18next';
import { Provider } from 'react-redux';
import { applyMiddleware, compose, createStore, Store } from 'redux';
import { electronEnhancer } from 'redux-electron-store';
import thunkMiddleware from 'redux-thunk';

import extensionRequire from './util/extensionRequire';

log('debug', 'renderer process started', { pid: process.pid });

stopTime();

extensionRequire();

remote.app.setPath('temp', path.join(remote.app.getPath('userData'), 'temp'));
crashReporter.start({
  productName: 'Vortex',
  companyName: 'Black Tree Gaming Ltd.',
  submitURL: 'https://localhost',
  uploadToServer: false,
});

// allow promises to be cancelled.
Promise.config({ cancellation: true });

// set up store. Through the electronEnhancer this is automatically
// synchronized with the main process store

const filter = true;
const middleware = [
  thunkMiddleware,
];

let enhancer = null;

if (process.env.NODE_ENV === 'development') {
  // tslint:disable-next-line:no-var-requires
  const DevTools: typeof DevToolsType = require('./util/DevTools').default;
  enhancer = compose(
    applyMiddleware(...middleware),
    electronEnhancer({ filter }),
    DevTools.instrument(),
  );
} else {
  enhancer = compose(
    applyMiddleware(...middleware),
    electronEnhancer({ filter }),
  );
}

process.on('uncaughtException', (error: any) => {
  let details: ITermination;

  switch (typeof error) {
    case 'object': {
      details = { message: error.message, details: error.stack };
    }              break;
    case 'string': {
      details = { message: error };
    }              break;
    default: {
      details = { message: error };
    }        break;
  }

  terminate(details);
});

const eventEmitter: NodeJS.EventEmitter = new EventEmitter();

stopTime = timeRequire();

const store: Store<any> = createStore(reducer([]), enhancer);

const extensions: ExtensionManager = new ExtensionManager(store, eventEmitter);
const extReducers = extensions.getReducers();

store.replaceReducer(reducer(extReducers));
extensions.setStore(store);
extensions.applyExtensionsOfExtensions();
stopTime();
log('debug', 'renderer connected to store');

let startupFinished: () => void;
const startupPromise = new Promise((resolve) => startupFinished = resolve);

// tslint:disable-next-line:no-unused-variable
const globalNotifications = new GlobalNotifications(extensions.getApi());

ipcRenderer.on('external-url', (event, url) => {
  startupPromise
    .then(() => {
      const protocol = url.split(':')[0];

      const handler = extensions.getProtocolHandler(protocol);
      if (handler !== null) {
        log('info', 'handling url', { url });
        handler(url);
      } else {
        log('warn', 'not handling url, unknown protocol', { url });
      }
    });
});

let currentLanguage: string = store.getState().settings.interface.language;
store.subscribe(() => {
  const newLanguage: string = store.getState().settings.interface.language;
  if (newLanguage !== currentLanguage) {
    currentLanguage = newLanguage;
    changeLanguage(newLanguage, (err, t) => {
      if (err !== undefined) {
        showError(store.dispatch, 'failed to activate language', err);
      }
    });
  }
});

let i18n;
let tFunc;
let error;

getI18n(store.getState().settings.interface.language)
  .then(res => {
    ({ i18n, tFunc, error } = res);
    extensions.setTranslation(i18n);
    return extendStore(store, extensions);
  })
  .then(() => {
    if (error !== undefined) {
      showError(store.dispatch, 'failed to initialize localization', error);
    }
    extensions.doOnce();
    extensions.renderStyle()
    .then(() => {
      ipcRenderer.send('show-window');
    })
    .catch(err => {
      terminate({
        message: 'failed to parse UI theme',
        details: err.formatted,
      });
    });
    initApplicationMenu(extensions);
    startupFinished();
    // render the page content
    ReactDOM.render(
      <Provider store={store}>
        <I18nextProvider i18n={i18n}>
          <ExtensionProvider extensions={extensions}>
            <MainWindow className='full-height' api={extensions.getApi()} t={tFunc} />
          </ExtensionProvider>
        </I18nextProvider>
      </Provider>,
      document.getElementById('content'),
    );
  });

// prevent the page from being changed through drag&drop
document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault();
};
