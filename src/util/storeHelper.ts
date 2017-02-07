import { IGameStored } from '../extensions/gamemode_management/types/IGameStored';

import { activeGameId } from './selectors';

import * as Promise from 'bluebird';

/**
 * return an item from state or the fallback if the path doesn't lead
 * to an item.
 * 
 * @export
 * @template T
 * @param {*} state
 * @param {string[]} path
 * @param {T} fallback
 * @returns {T}
 */
export function getSafe<T>(state: any, path: string[], fallback: T): T {
  let current = state;
  for (let segment of path) {
    if ((current === undefined) || !current.hasOwnProperty(segment)) {
      return fallback;
    } else {
      current = current[segment];
    }
  }
  return current;
}

export function mutateSafe<T>(state: T, path: string[], value: any) {
  let firstElement: string = path[0];
  if (path.length === 1) {
    state[firstElement] = value;
  } else {
    if (!state.hasOwnProperty(firstElement)) {
      state[firstElement] = {};
    }
    mutateSafe(state[firstElement], path.slice(1), value);
  }
}

/**
 * set an item in state, creating all intermediate nodes as necessary
 * 
 * @export
 * @template T
 * @param {T} state
 * @param {string[]} path
 * @param {*} value
 * @returns {T}
 */
export function setSafe<T>(state: T, path: string[], value: any): T {
  if (path.length === 0) {
    return Object.assign({}, value);
  }
  let firstElement: string = path[0];
  let copy;
  if (Array.isArray(state)) {
    copy = state.slice();
  } else {
    copy = Object.assign({}, state);
  }
  if (path.length === 1) {
    copy[firstElement] = value;
  } else {
    if (!copy.hasOwnProperty(firstElement)) {
      copy[firstElement] = {};
    }
    copy[firstElement] = setSafe(copy[firstElement], path.slice(1), value);
  }
  return copy;
}

/**
 * sets a value or do nothing if the path (except for the last element) doesn't exist.
 * That is: setOrNop does not create the object hierarchy referenced in the path but
 * it does add a new attribute to the object if necessary.
 * 
 * @export
 * @template T
 * @param {T} state
 * @param {string[]} path
 * @param {*} value
 * @returns {T}
 */
export function setOrNop<T>(state: T, path: string[], value: any): T {
  let firstElement: string = path[0];
  let result = state;
  if (path.length === 1) {
    result = Object.assign({}, state);
    result[firstElement] = value;
  } else {
    if (state.hasOwnProperty(firstElement)) {
      let temp = setOrNop(result[firstElement], path.slice(1), value);
      if (temp !== state[firstElement]) {
        result = Object.assign({}, state);
        result[firstElement] = temp;
      }
    }
  }
  return result;
}

/**
 * sets a value or do nothing if the path or the key (last element of the path) doesn't exist.
 * This means changeOrNop only changes a pre-existing object attribute
 * 
 * @export
 * @template T
 * @param {T} state
 * @param {string[]} path
 * @param {*} value
 * @returns {T}
 */
export function changeOrNop<T>(state: T, path: string[], value: any): T {
  let firstElement: string = path[0];
  let result = state;
  if (path.length === 1) {
    if (state.hasOwnProperty(firstElement)) {
      result = Object.assign({}, state);
      result[firstElement] = value;
    }
  } else {
    if (state.hasOwnProperty(firstElement)) {
      let temp = changeOrNop(result[firstElement], path.slice(1), value);
      if (temp !== state[firstElement]) {
        result = Object.assign({}, state);
        result[firstElement] = temp;
      }
    }
  }
  return result;
}

/**
 * delete a value or do nothing if the path doesn't exist
 * 
 * @export
 * @template T
 * @param {T} state
 * @param {string[]} path
 * @returns {T}
 */
export function deleteOrNop<T>(state: T, path: string[]): T {
  let firstElement: string = path[0];
  let result = state;
  if (path.length === 1) {
    if (state.hasOwnProperty(firstElement)) {
      result = Object.assign({}, state);
      delete result[firstElement];
    }
  } else {
    if (result.hasOwnProperty(firstElement)) {
      let temp = deleteOrNop(result[firstElement], path.slice(1));
      if (temp !== state[firstElement]) {
        result = Object.assign({}, state);
        result[firstElement] = temp;
      }
    }
  }

  return result;
}

function setDefaultArray<T>(state: T, path: string[], fallback: any[]): T {
  let firstElement: string = path[0];
  let copy = Object.assign({}, state);
  if (path.length === 1) {
    if (!copy.hasOwnProperty(firstElement) || (copy[firstElement] === undefined)) {
      copy[firstElement] = fallback;
    } else {
      copy[firstElement] = copy[firstElement].slice();
    }
  } else {
    if (!copy.hasOwnProperty(firstElement)) {
      copy[firstElement] = {};
    }
    copy[firstElement] = setDefaultArray(copy[firstElement], path.slice(1), fallback);
  }
  return copy;
}

/**
 * push an item to an array inside state. This creates all intermediate
 * nodes and the array itself as necessary
 * 
 * @export
 * @template T
 * @param {T} state
 * @param {string[]} path
 * @param {*} value
 * @returns {T}
 */
export function pushSafe<T>(state: T, path: string[], value: any): T {
  let copy = setDefaultArray(state, path, []);
  getSafe(copy, path, undefined).push(value);
  return copy;
}

/**
 * remove a value from an array by value
 * 
 * @export
 * @template T
 * @param {T} state
 * @param {string[]} path
 * @param {*} value
 * @returns {T}
 */
export function removeValue<T>(state: T, path: string[], value: any): T {
  let copy = setDefaultArray(state, path, []);
  let list = getSafe(copy, path, undefined);
  const idx = list.indexOf(value);
  if (idx !== -1) {
    list.splice(idx, 1);
  }
  return copy;
}

/**
 * remove all vales for which the predicate applies
 * 
 * @export
 * @template T
 * @param {T} state
 * @param {string[]} path
 * @param {(element: any) => boolean} predicate
 * @returns {T}
 */
export function removeValueIf<T>(state: T, path: string[],
                                 predicate: (element: any) => boolean): T {
  return setSafe(state, path, getSafe(state, path, []).filter((ele) => !predicate(ele)));
}

/**
 * shallow merge a value into the store at the  specified location
 * 
 * @export
 * @template T
 * @param {T} state
 * @param {string[]} path
 * @param {Object} value
 * @returns {T}
 */
export function merge<T>(state: T, path: string[], value: Object): T {
  const newVal = Object.assign({}, getSafe(state, path, {}), value);
  return setSafe(state, path, newVal);
}

function waitUntil(predicate: () => boolean, interval: number = 100): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      if (predicate()) {
        resolve();
      } else {
        return waitUntil(predicate, interval);
      }
    }, interval);
  });
}

/**
 * return the stored static details about the currently selected game mode
 * or a fallback with the id '__placeholder'
 * the return value is a promise because known games are loaded during extension
 * initialization so there is quite a bit of code where we can't be sure
 * if this is yet available
 * 
 * @export
 * @param {*} state
 * @returns {Promise<IGameStored>}
 */
export function currentGame(store: Redux.Store<any>): Promise<IGameStored> {
  const fallback = {id: '__placeholder', name: '<No game>', requiredFiles: []};
  let knownGames = getSafe(store.getState(), ['session', 'gameMode', 'known'], null);
  if ((knownGames !== null) && (knownGames !== undefined)) {
    const gameMode = activeGameId(store.getState());
    let res = knownGames.find((ele: IGameStored) => ele.id === gameMode);
    return Promise.resolve(res || fallback);
  } else {
    return waitUntil(() => {
             knownGames =
                 getSafe(store.getState(), ['session', 'gameMode', 'known'], null);
             return (knownGames !== null) && (knownGames !== undefined);
           })
        .then(() => {
          const gameMode = activeGameId(store.getState());

          const res = knownGames.find((ele: IGameStored) => ele.id === gameMode);
          return Promise.resolve(res || fallback);
        });
  }
}
