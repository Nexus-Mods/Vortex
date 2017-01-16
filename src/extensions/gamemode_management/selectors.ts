import {getSafe} from '../../util/storeHelper';

import {IGameStored} from './types/IStateEx';

import { createSelector } from 'reselect';

export function knownGames(state): IGameStored[] {
  return getSafe(state, ['session', 'gameMode', 'known'], []);
}

export function currentGameMode(state): string {
  return getSafe(state, ['settings', 'gameMode', 'current'], undefined);
}

export const currentGame =
  createSelector(knownGames, currentGameMode, (knownGames, currentGameMode) => {
    return knownGames.find((game: IGameStored) => game.id === currentGameMode);
    });
