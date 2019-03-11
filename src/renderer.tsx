/**
 * entry point for the renderer process(es)
 */

const earlyErrHandler = (evt) => {
  const {error} = evt;
  const { remote } = require('electron');
  remote.dialog.showErrorBox('Unhandled error', error.stack);
  remote.app.exit(1);
};

// turn all error logs into a single parameter. The reason is that (at least in production)
// these only get reported by the main process and due to a "bug" only one parameter gets
// relayed.
const oldErr = console.error;
console.error = (...args) => {
  oldErr(args.concat(' ') + '\n' + (new Error()).stack);
}

window.addEventListener('error', earlyErrHandler);
window.addEventListener('unhandledrejection', earlyErrHandler);

import requireRemap from './util/requireRemap';
requireRemap();

if (process.env.NODE_ENV === 'development') {
  // tslint:disable-next-line:no-var-requires
  const rebuildRequire = require('./util/requireRebuild').default;
  rebuildRequire();
  process.traceProcessWarnings = true;
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
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
import reducer, { Decision } from './reducers/index';
import { setOutdated, terminate, toError } from './util/errorHandling';
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
import { ipcRenderer, remote, webFrame } from 'electron';
import { forwardToMain, getInitialStateRenderer, replayActionRenderer } from 'electron-redux';
import { EventEmitter } from 'events';
import * as I18next from 'i18next';
import { changeLanguage } from 'i18next';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { I18nextProvider } from 'react-i18next';
import { Provider } from 'react-redux';
import { applyMiddleware, compose, createStore } from 'redux';
import thunkMiddleware from 'redux-thunk';

import crashDump from 'crash-dump';

// ensures tsc includes this dependency
import { ThunkStore } from './types/IExtensionContext';
import { UserCanceled } from './util/CustomErrors';
import {} from './util/extensionRequire';
import { reduxLogger } from './util/reduxLogger';
import { getSafe } from './util/storeHelper';
import { getAllPropertyNames } from './util/util';

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

const middleware = [
  thunkMiddleware,
  reduxSanity(sanityCheckCB),
  reduxLogger(),
];

function sanityCheckCB(err: StateError) {
  showError(store.dispatch,
    'An invalid state change was prevented, this was probably caused by a bug', err);
}

let store: ThunkStore<any>;

const terminateFromError = (error: any) => {
  log('warn', 'about to report an error', { stack: new Error().stack });
  terminate(toError(error), store !== undefined ? store.getState() : {});
};

function errorHandler(evt: any) {
  const error = evt.reason
      || evt.error
      || ((evt.detail !== undefined) ? evt.detail.reason : undefined)
      || evt.message;

  if (error instanceof UserCanceled) {
    return;
  }

  if ((error === undefined) || (getAllPropertyNames(error).length === 0)) {
    log('error', 'empty error object ignored', { wasPromise: evt.promise !== undefined });
    return;
  }

  if (error.name === 'Invariant Violation') {
    // these may not get caught, even when we have an ErrorBoundary, if the exception happens
    // in some callback. Onfortunately this also makes these errors almost impossible to find,
    // the code-stack is pointless (it's only react interna) and the component-stack gets
    // stripped in production builds.
    log('error', 'react invariant violation', { error: error.message, stack: error.stack });
    return;
  }

  if ((error !== undefined)
      && (error.stack !== undefined)
      // TODO: socket hang up should trigger another error that we catch,
      //  unfortunately I don't know yet if this is caused by mod download
      //  or vortex update check or api requests and why it's unhandled but
      //  reports indicate it's probably the api
      && (
          (error.message === 'socket hang up')
          || (error.stack.indexOf('net::ERR_CONNECTION_RESET') !== -1)
          || (error.stack.indexOf('net::ERR_ABORTED') !== -1)
          || (error.stack.indexOf('PackeryItem.proto.positionDropPlaceholder') !== -1)
         )
      ) {
    log('warn', 'suppressing error message', { message: error.message, stack: error.stack });
    // bit of a hack: The main process checks the console log during startup and if an error
    // is reported and the main window not presented within a certain time, it will relay the
    // error and quit.
    // By logging this error here we ensure that even a suppressed error will be reported to
    // user _if_ it managed to prevent the application start. Of course it would be nicer
    // if there was a proper api for that but it's quite the fringe case I think
    console.error(error.stack);
    return true;
  } else {
    terminateFromError(error);
  }
}

window.addEventListener('error', errorHandler);
window.addEventListener('unhandledrejection', errorHandler);
window.removeEventListener('error', earlyErrHandler);
window.removeEventListener('unhandledrejection', earlyErrHandler);

const eventEmitter: NodeJS.EventEmitter = new EventEmitter();

let enhancer = null;

if (process.env.NODE_ENV === 'development') {
  // tslint:disable-next-line:no-var-requires
  const freeze = require('redux-freeze');
  const devtool = (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__();
  enhancer = compose(
    applyMiddleware(
      forwardToMain,
      ...middleware,
      freeze),
    devtool || (id => id),
  );
} else {
  enhancer = compose(
    applyMiddleware(
      forwardToMain,
      ...middleware
    ),
  );
}

// extension manager initialized without store, the information about what
// extensions are to be loaded has to be retrieved from the main process
const extensions: ExtensionManager = new ExtensionManager(undefined, eventEmitter);
const extReducers = extensions.getReducers();
let tFunc: I18next.TranslationFunction = (input, options) => input;

// I only want to add reducers, but redux-electron-store seems to break
// when calling replaceReducer in the renderer
// (https://github.com/samiskin/redux-electron-store/issues/48)
// now that we're not using it any more, may want to try again
// store.replaceReducer(reducer(extReducers));
store = createStore(
  reducer(extReducers, () => Decision.QUIT),
  getInitialStateRenderer(),
  enhancer);
replayActionRenderer(store);
extensions.setStore(store);
setOutdated(extensions.getApi());
extensions.applyExtensionsOfExtensions();
log('debug', 'renderer connected to store');

let startupFinished: () => void;
const startupPromise = new Promise((resolve) => startupFinished = resolve);

// tslint:disable-next-line:no-unused-variable
const globalNotifications = new GlobalNotifications(extensions.getApi());

ipcRenderer.on('external-url', (event, url) => {
  startupPromise
    .then(() => {
      if (typeof(url) !== 'string') {
        return;
      }
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
  let i18n: I18next.i18n;
  let error: Error;

  webFrame.setZoomFactor(getSafe(store.getState(), ['settings', 'window', 'zoomFactor'], 1));

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
      log('debug', 'render with language', { language: i18n.language });
      const refresh = initApplicationMenu(extensions);
      extensions.getApi().events.on('gamemode-activated', () => refresh());
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
