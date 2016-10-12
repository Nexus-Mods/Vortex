/**
 * top level reducer. This combines all reducers into one
 */

/**
 * dummy comment
 */
import { IExtensionReducer } from '../types/Extension';
import { IReducerSpec } from '../types/IExtensionContext';

import { accountReducer } from './account';
import { notificationsReducer } from './notifications';
import { windowReducer } from './window';

import { combineReducers } from 'redux';
import { createReducer } from 'redux-act';

function deriveReducer(path, ele): Redux.Reducer<any> {
  let attributes: string[] = Object.keys(ele);

  if ((attributes.indexOf('reducers') !== -1)
      && (attributes.indexOf('defaults') !== -1)) {
    if (attributes.length !== 2) {
      throw new Error(`invalid settings structure at ${path}`);
    }
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

function recursiveObjectKeys(tree: Object, prefix: string = '') {
  let result = [];
  for (let key of Object.keys(tree)) {
    const fullKey = prefix + '.' + key;
    result.push(fullKey);
    if ((typeof(tree[key]) === 'object') && (tree[key] !== null)) {
      result = result.concat(recursiveObjectKeys(tree[key], fullKey));
    }
  }
  return result;
}

export default function (extensionReducers: IExtensionReducer[]) {
  let tree = {
    window: {
      base: windowReducer,
    },
    account: {
      base: accountReducer,
    },
    gameSettings: {
    },
    notifications: notificationsReducer,
    session: {
    },
    settings: {
    },
  };

  extensionReducers.forEach((extensionReducer) => {
    addToTree(tree, extensionReducer.path, extensionReducer.reducer);
  });

  return deriveReducer('', tree);
}
