/**
 * top level reducer. This combines all reducers into one
 */

/**
 * dummy comment
 */
import { IExtensionReducer } from '../types/Extension';
import { IReducerSpec, IStateVerifier } from '../types/IExtensionContext';
import deepMerge from '../util/deepMerge';
import { log } from '../util/log';
import { getSafe, rehydrate, setSafe, deleteOrNop } from '../util/storeHelper';

import { appReducer } from './app';
import { notificationsReducer } from './notifications';
import { sessionReducer } from './session';
import { tableReducer } from './tables';
import { userReducer } from './user';
import { windowReducer } from './window';

import { dialog as dialogIn, remote } from 'electron';
import update from 'immutability-helper';
import { pick } from 'lodash';
import { combineReducers, Reducer, ReducersMapObject } from 'redux';
import { createReducer } from 'redux-act';
// tslint:disable-next-line:no-submodule-imports

const dialog = dialogIn || remote.dialog;

/**
 * wrapper for combineReducers that doesn't drop unexpected keys
 */
function safeCombineReducers(reducer: ReducersMapObject) {
  const redKeys = Object.keys(reducer);
  const combined = combineReducers(reducer);
  return (state, action) => {
    const red = state !== undefined
      ? pick(state, redKeys)
      : undefined;
    return {
      ...state,
      ...combined(red, action),
    };
  };
}

function verifyElement(verifier: IStateVerifier, value: any) {
  if ((verifier.type !== undefined)
      && (verifier.required || (value !== undefined))
      && (typeof(value) !== verifier.type)) {
    return false;
  }
  if ((verifier.noUndefined === true)
      && (value === undefined)) {
    return false;
  }
  if ((verifier.noNull === true)
      && (value === null)) {
    return false;
  }
  return true;
}

function verify(path: string, verifiers: { [key: string]: IStateVerifier },
                input: any, defaults: { [key: string]: any }) {
  if (input === undefined) {
    return input;
  }
  let res = input;
  Object.keys(verifiers).forEach(key => {
    if (key === '_') {
      Object.keys(res).forEach(mapKey => {
        const sane = verify(path, verifiers[key].elements, res[mapKey], {});
        if (sane !== res[mapKey]) {
          if (sane === undefined) {
            res = deleteOrNop(res, [mapKey]);
          } else {
            res = update(res, { [mapKey]: { $set: sane } });
          }
        }
      });
    } else if ((verifiers[key].required || input.hasOwnProperty(key))
               && !verifyElement(verifiers[key], input[key])) {
      log('warn', 'invalid state', { path, input, key, ver: verifiers[key] });
      if (verifiers[key].deleteBroken !== undefined) {
        if (verifiers[key].deleteBroken === 'parent') {
          res = undefined;
        } else {
          res = deleteOrNop(res, [key]);
        }
      } else {
        res = update(res, { [key]: { $set:
          (verifiers[key].repair !== undefined)
          ? verifiers[key].repair(input[key], defaults[key])
          : defaults[key] } });
      }
    }
  });
  return res;
}

enum Decision {
  SANITIZE,
  IGNORE,
  QUIT,
}

let sanitizeDecision: Decision;

function decideSanitize(): Decision {
  if (sanitizeDecision === undefined) {
    // untranslated because localization isn't loaded at this point
    const response = dialog.showMessageBox(null, {
      message:
          'Application state is invalid. I can try to repair it but you may lose data',
      buttons: ['Quit', 'Ignore', 'Repair'],
    });

    sanitizeDecision =
        [Decision.QUIT, Decision.IGNORE, Decision.SANITIZE][response];
  }

  return sanitizeDecision;
}

function deriveReducer(path: string, ele: any): Reducer<any> {
  const attributes: string[] = Object.keys(ele);

  if ((attributes.indexOf('reducers') !== -1)
      && (attributes.indexOf('defaults') !== -1)) {
    let red = ele.reducers;
    const pathArray = path.split('.').slice(1);
    if (red['__hydrate'] === undefined) {
      red = {
        ...ele.reducers,
        ['__hydrate']: (state, payload) => {
          if ((ele.verifiers !== undefined)
              && (sanitizeDecision !== Decision.IGNORE)) {
            const input = getSafe(payload, pathArray, undefined);
            const sanitized = verify(path, ele.verifiers, input,
                                     ele.defaults);
            if (sanitized !== input) {
              const decision = decideSanitize();
              if (decision === Decision.SANITIZE) {
                payload = setSafe(payload, pathArray, sanitized);
              } else if (decision === Decision.QUIT) {
                process.exit();
              } // in case of ignore we just continue with the original payload
            }
          }
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
    if (spec.verifiers !== undefined) {
      tree.verifiers = deepMerge(tree.verifiers, spec.verifiers);
    }
  } else {
    if (!(path[0] in tree)) {
      tree[path[0]] = {};
    }
    addToTree(tree[path[0]], path.slice(1), spec);
  }
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
