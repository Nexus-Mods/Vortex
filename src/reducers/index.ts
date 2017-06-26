/**
 * top level reducer. This combines all reducers into one
 */

/**
 * dummy comment
 */
import { IExtensionReducer } from '../types/Extension';
import { IReducerSpec } from '../types/IExtensionContext';

import { appReducer } from './app';
import { notificationsReducer } from './notifications';
import { sessionReducer } from './session';
import { tableReducer } from './tables';
import { windowReducer } from './window';

import { combineReducers } from 'redux';
import { createReducer } from 'redux-act';

function deriveReducer(path, ele): Redux.Reducer<any> {
  const attributes: string[] = Object.keys(ele);

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

  const result = {};
  for (const key of Object.keys(lhs).concat(Object.keys(rhs))) {
    if ((lhs[key] === undefined) || (rhs[key] === undefined)) {
      result[key] = lhs[key] || rhs[key];
    }

    result[key] = ((typeof(lhs[key]) === 'object') && (typeof(lhs[key]) === 'object'))
      ? result[key] = deepMerge(lhs[key], rhs[key])
      : (Array.isArray(lhs[key]) && Array.isArray(rhs[key]))
        ? result[key] = lhs[key].concat(rhs[key])
        : result[key] = rhs[key] || lhs[key];
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

function recursiveObjectKeys(tree: any, prefix: string = '') {
  let result = [];
  for (const key of Object.keys(tree)) {
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
export default function(extensionReducers: IExtensionReducer[]) {
  const tree = {
    confidential: {
      account: {
      },
    },
    session: {
      base: sessionReducer,
      notifications: notificationsReducer,
    },
    settings: {
      window: windowReducer,
    },
    persistent: {
      app: appReducer,
      tables: tableReducer,
    },
  };

  extensionReducers.forEach((extensionReducer) => {
    addToTree(tree, extensionReducer.path, extensionReducer.reducer);
  });

  return deriveReducer('', tree);
}
