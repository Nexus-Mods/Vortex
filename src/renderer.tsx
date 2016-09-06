/**
 * entry point for the renderer process(es)
 */

import reducer from './reducers/index';
import { log } from './util/log';
import { MainWindow } from './views/MainWindow';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
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

const store: Store<any> = createStore(reducer, enhancer);

log('info', 'renderer connected to store');

// render the page content 

ReactDOM.render(
  <Provider store={store}>
    <MainWindow className='full-height'/>
  </Provider>,
  document.getElementById('content')
);
