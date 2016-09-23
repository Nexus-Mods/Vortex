/**
 * top level reducer. This combines all reducers into one
 */

/**
 * dummy comment
 */
import { IExtensionReducer } from '../types/Extension';
import { log } from '../util/log';

import { accountReducer } from './account';
import { gameSettingsReducer } from './gameSettings';
import { notificationsReducer } from './notifications';
import { sessionReducer } from './session';
import { settingsReducer } from './settings';
import { windowReducer } from './window';

import { combineReducers } from 'redux';

function reduceReducer(path, reducer, tree) {
  if (!(path[0] in tree)) {
    tree[path[0]] = {};
  }
  if (path.length === 1) {
    tree[path[0]][''] = reducer;
  } else {
    reduceReducer(path.slice(1), reducer, tree[path[0]]);
  }
}

function buildReducerTree(reducers: IExtensionReducer[]) {
  let result = {};

  reducers.forEach((ele) => { reduceReducer(ele.path, ele.reducer, result); });

  return result;
}

function deriveReducer(ele) {
  if (typeof(ele) === 'function') {
    return ele;
  } else {
    for (let key of Object.keys(ele)) {
      ele[key] = deriveReducer(ele[key]);
    }
    return combineReducers(
      ele
    );
  }
}

export default function (extensionReducers: IExtensionReducer[]) {
  let tree = buildReducerTree(extensionReducers.concat([
      { path: ['window'], reducer: windowReducer },
      { path: ['account'], reducer: accountReducer },
      { path: ['gameSettings'], reducer: gameSettingsReducer },
      { path: ['notifications'], reducer: notificationsReducer },
      { path: ['session'], reducer: sessionReducer },
      { path: ['settings'], reducer: settingsReducer },
  ]));

  log('info', 'reducer tree', { tree: Object.keys(tree) });

  return deriveReducer(tree);
}
