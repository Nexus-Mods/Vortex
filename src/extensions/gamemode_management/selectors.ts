import { IState } from '../../types/IState';
import {activeGameId} from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';

import {IDiscoveryResult} from './types/IDiscoveryResult';
import {IGameStored} from './types/IGameStored';

import { SITE_ID } from './constants';

import createCachedSelector from 're-reselect';
import { createSelector } from 'reselect';

export function knownGames(state): IGameStored[] {
  return getSafe(state, ['session', 'gameMode', 'known'], []);
}

function discovered(state: IState): { [id: string]: IDiscoveryResult } {
  return state.settings.gameMode.discovered;
}

export const currentGame =
  createSelector(knownGames, activeGameId, (games, currentGameMode) =>
    games.find(game => game.id === currentGameMode),
    );

export const gameById =
  createCachedSelector(knownGames, (state: IState, gameId: string) => gameId, (games, gameId) =>
    games.find(game => game.id === gameId))((state, gameId) => gameId);

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

export const discoveryByGame =
  createCachedSelector(discovered,
    (state: IState, gameId: string) => gameId,
    (discoveredIn, gameId) => discoveredIn[gameId],
  )((state, gameId) => gameId);

export function gameName(state: any, gameId: string): string {
  if (gameId === SITE_ID) {
    return 'Tools & Extensions';
  }
  const fromDiscovery = getSafe(
      state, ['settings', 'gameMode', 'discovered', gameId, 'name'], undefined);
  if (fromDiscovery !== undefined) {
    return fromDiscovery;
  }

  const known = getSafe(state, ['session', 'gameMode', 'known'], [] as IGameStored[])
                    .find(game => game.id === gameId);
  if (known !== undefined) {
    return known.name;
  } else {
    return undefined;
  }
}
