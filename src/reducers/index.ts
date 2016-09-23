/**
 * top level reducer. This combines all reducers into one
 */

/**
 * dummy comment
 */
import { IExtensionReducer } from '../types/Extension';
import { IReducerSpec } from '../types/IExtensionContext';
import { log } from '../util/log';

import { accountReducer } from './account';
import { gameSettingsReducer } from './gameSettings';
import { notificationsReducer } from './notifications';
import { sessionReducer } from './session';
import { settingsReducer } from './settings';
import { windowReducer } from './window';

import { combineReducers } from 'redux';
import { createReducer } from 'redux-act';

function deriveReducer(path, ele): Redux.Reducer<any> {
  let attributes: string[] = Object.keys(ele);

  log('info', 'ele', { ele, attributes });

  if ((attributes.indexOf('reducers') !== -1)
      && (attributes.indexOf('defaults') !== -1)) {
    if (attributes.length !== 2) {
      throw new Error(`invalid settings structure at ${path}`);
    }
    log('info', 'leaf reducer', { red: ele.reducers, def:  ele.defaults });
    return createReducer(ele.reducers, ele.defaults);
  } else {
    const reducers: Redux.ReducersMapObject = {};

    attributes.forEach((attribute) => {
      reducers[attribute] = deriveReducer(path + '.' + attribute, ele[attribute]);
    });
    return combineReducers(reducers);
  }
}

function addToTree(tree: any, path: string[], spec: IReducerSpec) {
  log('info', 'path', { path });
  if (path.length === 0) {
    if (tree.reducers === undefined) {
      tree.reducers = {};
    }
    if (tree.defaults === undefined) {
      tree.defaults = {};
    }
    Object.assign(tree.reducers, spec.reducers);
    Object.assign(tree.defaults, spec.defaults);
  } else {
    if (!(path[0] in tree)) {
      tree[path[0]] = {};
    }
    addToTree(tree[path[0]], path.slice(1), spec);
  }
}

export default function (extensionReducers: IExtensionReducer[]) {
  let tree = {
    window: windowReducer,
    account: accountReducer,
    gameSettings: {
      base: gameSettingsReducer,
    },
    notifications: notificationsReducer,
    session: sessionReducer,
    settings: {
      base: settingsReducer,
    }
  };

  extensionReducers.forEach((extensionReducer) => {
    addToTree(tree, extensionReducer.path, extensionReducer.reducer);
  });

  /*
  let tree = buildReducerTree(extensionReducers.concat([
      { path: ['window'], reducer: windowReducer },
      { path: ['account'], reducer: accountReducer },
      { path: ['gameSettings'], reducer: gameSettingsReducer },
      { path: ['notifications'], reducer: notificationsReducer },
      { path: ['session'], reducer: sessionReducer },
      { path: ['settings'], reducer: settingsReducer },
  ]));
  */

  log('info', 'reducer tree', { tree: Object.keys(tree) });

  return deriveReducer('', tree);
}
