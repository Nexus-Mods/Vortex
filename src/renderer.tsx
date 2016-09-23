/**
 * entry point for the renderer process(es)
 */

import 'source-map-support/register';

import reducer from './reducers/index';
import { ITermination, terminate } from './util/errorHandling';
import ExtensionManager from './util/ExtensionLoader';
import { ExtensionProvider } from './util/ExtensionProvider';
import getI18n from './util/i18n';
import { log } from './util/log';
import { showError } from './util/message';
import MainWindow from './views/MainWindow';

import { changeLanguage } from 'i18next';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { I18nextProvider } from 'react-i18next';
import { Provider } from 'react-redux';
import { Store, applyMiddleware, compose, createStore } from 'redux';
import { electronEnhancer } from 'redux-electron-store';
import thunkMiddleware from 'redux-thunk';

log('info', 'renderer process started');

// set up store. Through the electronEnhancer this is automatically
// synchronized with the main process store

let filter = {
};

let middleware = [
  thunkMiddleware,
];

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

const extensions: ExtensionManager = new ExtensionManager();

let extReducers = extensions.getReducers();

const store: Store<any> = createStore(reducer(extReducers), enhancer);

extensions.setStore(store);

extensions.doOnce();

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

log('info', 'renderer connected to store');

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
        <MainWindow className='full-height'/>
      </ExtensionProvider>
    </I18nextProvider>
  </Provider>,
  document.getElementById('content')
);
