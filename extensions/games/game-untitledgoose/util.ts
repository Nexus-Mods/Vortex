import Bluebird from 'bluebird';
import { log, util } from 'vortex-api';
import { GAME_ID } from './statics';

// We _should_ just export this from vortex-api, but I guess it's not wise to make it
//  easy for users since we want to move away from bluebird in the future ?
export function toBlue<T>(func: (...args: any[]) => Promise<T>): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

export function getDiscoveryPath(state) {
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  if ((discovery === undefined) || (discovery.path === undefined)) {
    log('debug', 'untitledgoosegame was not discovered');
    return undefined;
  }

  return discovery.path;
}
