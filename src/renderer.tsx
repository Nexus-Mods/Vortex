/**
 * entry point for the renderer process(es)
 */

if (process.env.NODE_ENV === 'development') {
  // tslint:disable-next-line:no-var-requires
  const rebuildRequire = require('./util/requireRebuild');
  rebuildRequire();
}

import timeRequire from './util/timeRequire';
let stopTime = timeRequire();

if (process.env.NODE_ENV === 'production') {
  // TODO: the following hacks should, supposedly increase react
  //  performance by avoiding unnecessary "if (process.env.NODE_ENV === )"
  //  calls and speeding up the rest by turning process.env into a static
  //  object.
  //  I have not yet made any benchmarks to verify that
  // tslint:disable-next-line:no-var-requires no-submodule-imports
  require('react/dist/react.min.js');
  require.cache[require.resolve('react')] =
    require.cache[require.resolve('react/dist/react.min.js')];

  process.env = JSON.parse(JSON.stringify(process.env));
} else {
  // development environment
  process.traceProcessWarnings = true;
}

import * as path from 'path';

process.env.SASS_BINARY_PATH = path.resolve(
  path.dirname(path.dirname(require.resolve('node-sass'))), 'bin',
  `${process.platform}-${process.arch}-${process.versions.modules}`, 'node-sass.node');

import { addNotification } from './actions/notifications';
import reducer from './reducers/index';
import { IError } from './types/IError';
import { terminate } from './util/errorHandling';
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
import { crashReporter, ipcRenderer, remote } from 'electron';
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

import luckyOrange from './util/luckyorange';

// ensures tsc includes this dependency
import {} from './util/extensionRequire';

log('debug', 'renderer process started', { pid: process.pid });

stopTime();

const tempPath = path.join(remote.app.getPath('userData'), 'temp');
remote.app.setPath('temp', tempPath);

/*
doesn't work atm, see https://github.com/electron/electron/issues/11626

crashReporter.start({
  productName: 'Vortex',
  companyName: 'Black Tree Gaming Ltd.',
  submitURL: 'http://localhost',
  uploadToServer: false,
});*/

crashDump(path.join(remote.app.getPath('temp'), 'dumps', `crash-renderer-${Date.now()}.dmp`));

// allow promises to be cancelled.
Promise.config({
  cancellation: true,
  // long stack traces would be sooo nice but the performance cost in some places is ridiculous
  longStackTraces: false,
});

if (process.env.NODE_ENV !== 'development') {
  luckyOrange();
}

// set up store. Through the electronEnhancer this is automatically
// synchronized with the main process store

const filter = true;
const middleware = [
  thunkMiddleware,
  reduxSanity(sanityCheckCB),
];

function sanityCheckCB(err: StateError) {
  showError(store.dispatch,
    'An invalid state change was prevented, this was probably caused by a bug', err);
}

function findExtensionName(stack: string): string {
  if (stack === undefined) {
    return undefined;
  }
  const stackSplit = stack.split('\n').filter(line => line.match(/^[ ]*at /));
  const extPaths = ExtensionManager.getExtensionPaths();
  const expression = `(${extPaths.join('|').replace(/\\/g, '\\\\')})[\\\\/]([^\\\\/]*)`;
  const re = new RegExp(expression);

  let extension: string;
  stackSplit.find((line: string) => {
    // regular expression to parse the extension name from the path in the last
    // line of the stack trace. if there is one.
    const match = line.match(re);
    if (match !== null) {
      extension = match[2];
      return true;
    }
    return false;
  });
  return extension;
}

const terminateFromError = (error: any) => {
  let details: IError;

  switch (typeof error) {
    case 'object': {
      const extension = findExtensionName(error.stack);
      details = (error.message === undefined) && (error.stack === undefined)
        ? { message: require('util').inspect(error), extension }
        : { message: error.message, stack: error.stack, extension };
      break;
    }
    case 'string': {
      details = { message: error };
      break;
    }
    default: {
      details = { message: error };
      break;
    }
  }

  terminate(details);
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

process.on('uncaughtException' as any, (error: any) => {
  if (getMessageString(error).match(ignoredExceptions)) {
    return;
  } else if ((error.stack !== undefined)
          && ((error.stack.indexOf('clickstream.js') !== -1)
              || (error.stack.indexOf('cloudfront.net/w.js') !== -1))) {
    // ignore errors from clickstream
    return;
  }
  terminateFromError(error);
});

window.addEventListener('unhandledrejection', (evt: any) => {
  terminateFromError(evt.reason || evt.detail.reason);
});

const eventEmitter: NodeJS.EventEmitter = new EventEmitter();

stopTime = timeRequire();

let enhancer = null;

if (process.env.NODE_ENV === 'development') {
  // tslint:disable-next-line:no-var-requires
  enhancer = compose(
    applyMiddleware(...middleware),
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

function renderer() {
  let i18n;
  let error;

  getI18n(store.getState().settings.interface.language)
    .then(res => {
      ({ i18n, tFunc, error } = res);
      extensions.setTranslation(i18n);
      if (error !== undefined) {
        showError(store.dispatch, 'failed to initialize localization', error);
      }
      return extensions.doOnce();
    })
    .then(() => extensions.renderStyle()
        .catch(err => {
          terminate({
            message: 'failed to parse UI theme',
            details: err,
          });
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
