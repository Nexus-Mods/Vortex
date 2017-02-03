import {activeGameId} from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';

import {IDiscoveryResult} from './types/IDiscoveryResult';
import {IGameStored} from './types/IGameStored';

import { createSelector } from 'reselect';

export function knownGames(state): IGameStored[] {
  return getSafe(state, ['session', 'gameMode', 'known'], []);
}

export const currentGame =
  createSelector(knownGames, activeGameId, (knownGames, currentGameMode) => {
    return knownGames.find((game: IGameStored) => game.id === currentGameMode);
    });

/**
 * return the discovery information about a game
 * 
 * @export
 * @param {*} state
 * @returns {IDiscoveryResult}
 */
export function currentGameDiscovery(state: any): IDiscoveryResult {
  const gameMode = activeGameId(state);
  return getSafe(state, ['settings', 'gameMode', 'discovered', gameMode], undefined);
}
