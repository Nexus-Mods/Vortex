/**
 * top level reducer. This combines all reducers into one
 */

/**
 * dummy comment
 */
import { IExtensionReducer } from '../types/Extension';
import { IReducerSpec } from '../types/IExtensionContext';

import { notificationsReducer } from './notifications';
import { sessionReducer } from './session';
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

/**
 * very simplistic deep merge.
 * 
 * @param {*} lhs
 * @param {*} rhs
 * @returns {*}
 */
function deepMerge(lhs: any, rhs: any): any {
  if ((lhs === undefined) || (rhs === undefined) ||
      (lhs === null) || (rhs === null)) {
    return lhs || rhs;
  }

  let result = {};
  for (let key of Object.keys(lhs).concat(Object.keys(rhs))) {
    if ((lhs[key] === undefined) || (rhs[key] === undefined)) {
      result[key] = lhs[key] || rhs[key];
    }

    if ((typeof(lhs[key]) === 'object') && (typeof(lhs[key]) === 'object')) {
      result[key] = deepMerge(lhs[key], rhs[key]);
    } else if (Array.isArray(lhs[key]) && Array.isArray(rhs[key])) {
      result[key] = lhs[key].concat(rhs[key]);
    } else {
      result[key] = rhs[key] || lhs[key];
    }
  }
  return result;
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
    tree.defaults = deepMerge(tree.defaults, spec.defaults);
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

/**
 * initialize reducer tree
 * 
 * @export
 * @param {IExtensionReducer[]} extensionReducers
 * @returns
 */
export default function (extensionReducers: IExtensionReducer[]) {
  let tree = {
    window: {
      base: windowReducer,
    },
    account: {
    },
    gameSettings: {
    },
    notifications: notificationsReducer,
    session: {
      base: sessionReducer,
    },
    settings: {
    },
    persistent: {
    },
  };

  extensionReducers.forEach((extensionReducer) => {
    addToTree(tree, extensionReducer.path, extensionReducer.reducer);
  });

  return deriveReducer('', tree);
}
