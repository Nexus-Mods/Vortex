/**
 * top level reducer. This combines all reducers into one
 */

/**
 * dummy comment
 */
import { IExtensionReducer } from '../types/Extension';
import { IReducerSpec } from '../types/IExtensionContext';
import {rehydrate} from '../util/storeHelper';

import { appReducer } from './app';
import { notificationsReducer } from './notifications';
import { sessionReducer } from './session';
import { tableReducer } from './tables';
import { userReducer } from './user';
import { windowReducer } from './window';

import * as _ from 'lodash';
import { combineReducers, Reducer, ReducersMapObject } from 'redux';
import { createReducer } from 'redux-act';
import { REHYDRATE } from 'redux-persist/constants';

/**
 * wrapper for combineReducers that doesn't drop unexpected keys
 */
function safeCombineReducers(reducer: ReducersMapObject) {
  const redKeys = Object.keys(reducer);
  const combined = combineReducers(reducer);
  return (state, action) => {
    const red = state !== undefined
      ? _.pick(state, redKeys)
      : undefined;
    return {
      ...state,
      ...combined(red, action),
    };
  };
}

function deriveReducer(path: string, ele: any): Reducer<any> {
  const attributes: string[] = Object.keys(ele);

  if ((attributes.indexOf('reducers') !== -1)
      && (attributes.indexOf('defaults') !== -1)) {
    if (attributes.length !== 2) {
      throw new Error(`invalid settings structure at ${path}`);
    }
    let red = ele.reducers;
    const pathArray = path.split('.').slice(1);
    if (red[REHYDRATE] === undefined) {
      red = {
        ...ele.reducers,
        [REHYDRATE]: (state, payload) => {
          return rehydrate(state, payload, pathArray);
        },
      };
    }
    return createReducer(red, ele.defaults);
  } else {
    const combinedReducers: ReducersMapObject = {};

    attributes.forEach(attribute => {
      combinedReducers[attribute] = deriveReducer(path + '.' + attribute, ele[attribute]);
    });
    return safeCombineReducers(combinedReducers);
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
function reducers(extensionReducers: IExtensionReducer[]) {
  const tree = {
    user: userReducer,
    app: appReducer,
    session: {
      base: sessionReducer,
      notifications: notificationsReducer,
    },
    settings: {
      window: windowReducer,
      tables: tableReducer,
    },
  };

  extensionReducers.forEach(extensionReducer => {
    addToTree(tree, extensionReducer.path, extensionReducer.reducer);
  });

  return deriveReducer('', tree);
}

export default reducers;
