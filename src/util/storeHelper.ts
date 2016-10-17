import { IDiscoveryResult, IGameStored } from '../extensions/gamemode_management/types/IStateEx';
import { IProfile } from '../extensions/profile_management/types/IProfile';

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
    if (!current.hasOwnProperty(segment)) {
      return fallback;
    } else {
      current = current[segment];
    }
  }
  return current;
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
  let firstElement: string = path[0];
  let copy = Object.assign({}, state);
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

function setDefaultArray<T>(state: T, path: string[], fallback: any[]): T {
  let firstElement: string = path[0];
  let copy = Object.assign({}, state);
  if (path.length === 1) {
    if (!copy.hasOwnProperty(firstElement)) {
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

/**
 * return the stored static details about the currently selected game mode
 * or a fallback with the id '__placeholder'
 * 
 * @export
 * @param {*} state
 * @returns {IGameStored}
 */
export function currentGame(state: any): IGameStored {
  const gameMode = state.settings.gameMode.current;
  if (gameMode === undefined) {
      return { id: '__placeholder', name: '<No game>', requiredFiles: [] };
  }
  return state.session.gameMode.known.find((ele: IGameStored) => ele.id === gameMode);
}

/**
 * return the discovery information about a game
 * 
 * @export
 * @param {*} state
 * @returns {IDiscoveryResult}
 */
export function currentGameDiscovery(state: any): IDiscoveryResult {
  const gameMode = state.settings.gameMode.current;
  if (gameMode === undefined) {
    return {};
  }
  return state.settings.gameMode.discovery[gameMode];
}

/**
 * return the currently active profile
 * 
 * @export
 * @param {*} state
 * @returns {IProfile}
 */
export function currentProfile(state: any): IProfile {
  const profileId = state.gameSettings.profiles.currentProfile;
  return state.gameSettings.profiles.profiles[profileId];
}
