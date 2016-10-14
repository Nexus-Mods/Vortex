import { IDiscoveryResult, IGameStored } from '../extensions/gamemode_management/types/IStateEx';
import { IProfile } from '../extensions/profile_management/types/IProfile';

function setDefault<T>(state: any, path: string[], value: T): T {
  let current = state;
  for (let segment of path.slice(0, -1)) {
    if (!current.hasOwnProperty(segment)) {
      current[segment] = {};
    }
    current = current[segment];
  }
  let lastElement: string = path[path.length - 1];
  if (!current.hasOwnProperty(lastElement)) {
    current[lastElement] = value;
  }
  return current[lastElement];
}

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

export function setSafe<T>(state: T, path: string[], value: any): T {
  let copy = Object.assign({}, state);
  let lastElement: string = path[path.length - 1];
  setDefault(copy, path.slice(0, -1), {})[lastElement] = value;
  return copy;
}

export function pushSafe<T>(state: T, path: string[], value: any): T {
  let copy = Object.assign({}, state);
  setDefault(copy, path, []).push(value);
  return copy;
}

export function removeValue<T>(state: T, path: string[], value: any): T {
  let copy = Object.assign({}, state);
  let list = setDefault(copy, path, []);
  const idx = list.indexOf(value);
  if (idx !== -1) {
    list.splice(idx, 1);
  }
  return copy;
}

export function merge<T>(state: T, path: string[], value: Object): T {
  const newVal = Object.assign({}, getSafe(state, path, {}), value);
  return setSafe(state, path, newVal);
}

export function currentGame(state: any): IGameStored {
  const gameMode = state.settings.gameMode.current;
  if (gameMode === undefined) {
      return { id: '__placeholder', name: '<No game>', requiredFiles: [] };
  }
  return state.session.gameMode.known.find((ele: IGameStored) => ele.id === gameMode);
}

export function currentGameDiscovery(state: any): IDiscoveryResult {
  const gameMode = state.settings.gameMode.current;
  if (gameMode === undefined) {
    return {};
  }
  return state.settings.gameMode.discovery[gameMode];
}

export function currentProfile(state: any): IProfile {
  const profileId = state.gameSettings.profiles.currentProfile;
  return state.gameSettings.profiles.profiles[profileId];
}
