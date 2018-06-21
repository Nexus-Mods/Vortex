/**
 * entry point for the renderer process(es)
 */

import * as sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

if (process.env.NODE_ENV === 'development') {
  // tslint:disable-next-line:no-var-requires
  const rebuildRequire = require('./util/requireRebuild').default;
  rebuildRequire();
  process.traceProcessWarnings = true;
} else {
  // webpack will replace every occurrence of process.env.NODE_ENV in its endeavour to eliminate
  // dead code. It doesn't however set the environment variable itself for externals and the
  // replacement means I can't set the actual environment variable directly anymore because
  // "process.env.NODE_ENV = 'production'" would be converted to 'production' = 'production' at
  // build time. So FU very much webpack
  const key = 'NODE_ENV';
  process.env[key] = 'production';
}

import getVortexPath from './util/getVortexPath';

import * as path from 'path';

process.env.SASS_BINARY_PATH = path.resolve(getVortexPath('modules'), 'node-sass', 'bin',
  `${process.platform}-${process.arch}-${process.versions.modules}`, 'node-sass.node');

import { addNotification } from './actions/notifications';
import reducer from './reducers/index';
import { terminate, toError } from './util/errorHandling';
import ExtensionManager from './util/ExtensionManager';
import { ExtensionProvider } from './util/ExtensionProvider';
import GlobalNotifications from './util/GlobalNotifications';
import getI18n from './util/i18n';
import { log } from './util/log';
import { initApplicationMenu } from './util/menu';
import { showError } from './util/message';
import { reduxSanity, StateError } from './util/reduxSanity';
import MainWindow from './views/MainWindow';

import * as Promise from 'bluebird';
import { ipcRenderer, remote } from 'electron';
import { EventEmitter } from 'events';
import { changeLanguage } from 'i18next';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { I18nextProvider } from 'react-i18next';
import { Provider } from 'react-redux';
import { applyMiddleware, compose, createStore, Store } from 'redux';
import { electronEnhancer } from 'redux-electron-store';
import thunkMiddleware from 'redux-thunk';

import crashDump from 'crash-dump';

// ensures tsc includes this dependency
import {} from './util/extensionRequire';
import { reduxLogger } from './util/reduxLogger';

log('debug', 'renderer process started', { pid: process.pid });

const tempPath = path.join(remote.app.getPath('userData'), 'temp');
remote.app.setPath('temp', tempPath);

crashDump(path.join(remote.app.getPath('temp'), 'dumps', `crash-renderer-${Date.now()}.dmp`));

// allow promises to be cancelled.
Promise.config({
  cancellation: true,
  // long stack traces would be sooo nice but the performance cost in some places is ridiculous
  longStackTraces: false,
});

// set up store. Through the electronEnhancer this is automatically
// synchronized with the main process store

const filter = true;
const middleware = [
  thunkMiddleware,
  reduxSanity(sanityCheckCB),
  reduxLogger(),
];

function sanityCheckCB(err: StateError) {
  showError(store.dispatch,
    'An invalid state change was prevented, this was probably caused by a bug', err);
}

const terminateFromError = (error: any) => {
  terminate(toError(error), store !== undefined ? store.getState() : {});
};

function getMessageString(error: any): string {
  switch (typeof error) {
    case 'object': return error.message;
    case 'string': return error;
    default: error.toString();
  }
}

// this are error messages that are known to only appear as subsequent faults
// to an actual bug, so we ignore these as there should be a "proper" error reported.
// Since these are ui errors it should be fine to ignore them.
// If you add to this list, make sure you abso-fucking-lutely know ignoring the error
// is safe and that you don't suppress more than you intended!
const ignoredExceptions = new RegExp('(' + [
  'Cannot read property \'_currentElement\' of null',
  'Cannot read property \'__reactInternalInstance.*\' of null',
].join('|') + ')');

window.addEventListener('error', (evt: any) => {
  const {error} = evt;
  if ((error !== undefined)
      && (error.stack !== undefined)
      // TODO: socket hang up should trigger another error that we catch
      //  unfortunately I don't know yet if this is caused by mod download
      //  or vortex update check or api requests and why it's unhandled but
      //  reports indicate it's probably the api
      && (error.message === 'socket hang up')
      && (error.stack.indexOf('invokeGuardedCallbackDev') !== -1)) {
    return true;
  }

  terminateFromError(evt.reason
    || evt.error
    || ((evt.detail !== undefined) ? evt.detail.reason : undefined)
    || evt.message);
});

window.addEventListener('unhandledrejection', (evt: any) => {
  terminateFromError(evt.reason
    || evt.error
    || ((evt.detail !== undefined) ? evt.detail.reason : undefined)
    || evt.message);
});

const eventEmitter: NodeJS.EventEmitter = new EventEmitter();

let enhancer = null;

if (process.env.NODE_ENV === 'development') {
  // tslint:disable-next-line:no-var-requires
  const freeze = require('redux-freeze');
  enhancer = compose(
    applyMiddleware(...middleware, freeze),
    electronEnhancer({ filter }),
    (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__(),
  );
} else {
  enhancer = compose(
    applyMiddleware(...middleware),
    electronEnhancer({ filter }),
  );
}

// extension manager initialized without store, the information about what
// extensions are to be loaded has to be retrieved from the main process
const extensions: ExtensionManager = new ExtensionManager(undefined, eventEmitter);
const extReducers = extensions.getReducers();
let tFunc = (input, options) => input;

// I only want to add reducers, but redux-electron-store seems to break
// when calling replaceReducer in the renderer
// (https://github.com/samiskin/redux-electron-store/issues/48)
// store.replaceReducer(reducer(extReducers));
const store: Store<any> = createStore(reducer(extReducers), enhancer);
extensions.setStore(store);
extensions.applyExtensionsOfExtensions();
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
        store.dispatch(addNotification({
          type: 'info',
          message: tFunc('Vortex isn\'t set up to handle this protocol: {{url}}', {
            replace: { url },
          }),
        }));
      }
    });
});

ipcRenderer.on('relay-event', (sender, event, ...args) => {
  eventEmitter.emit(event, ...args);
});

ipcRenderer.on('register-relay-listener', (sender, event, ...noArgs) => {
  eventEmitter.on(event, (...args) => ipcRenderer.send('relay-event', event, ...args));
});

let currentLanguage: string = store.getState().settings.interface.language;
store.subscribe(() => {
  const newLanguage: string = store.getState().settings.interface.language;
  if (newLanguage !== currentLanguage) {
    currentLanguage = newLanguage;
    changeLanguage(newLanguage, (err, t) => {
      if (err !== undefined) {
        if (Array.isArray(err)) {
          // don't show ENOENT errors because it shouldn't really matter
          const filtErr = err.filter(iter => iter.code !== 'ENOENT');
          if (filtErr.length > 0) {
            showError(store.dispatch, 'failed to activate language', err, { allowReport: false });
          }
        } else {
          showError(store.dispatch, 'failed to activate language', err, { allowReport: false });
        }
      }
    });
  }
});

function renderer() {
  let i18n;
  let error;

  getI18n(store.getState().settings.interface.language)
    .then(res => {
      ({ i18n, tFunc, error } = res);
      extensions.setTranslation(i18n);
      if (error !== undefined) {
        showError(store.dispatch, 'failed to initialize localization', error,
                  { allowReport: false });
      }
      return extensions.doOnce();
    })
    .then(() => extensions.renderStyle()
        .catch(err => {
          terminate({
            message: 'failed to parse UI theme',
            details: err,
          }, store.getState());
        }))
    .then(() => {
      initApplicationMenu(extensions);
      startupFinished();
      eventEmitter.emit('startup');
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
      ipcRenderer.send('show-window');
    });

  // prevent the page from being changed through drag&drop
  document.ondragover = document.ondrop = (ev) => {
    ev.preventDefault();
  };
}

renderer();
