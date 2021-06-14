
import { log } from '../../util/log';

import { IGameLoadOrderEntry } from './types/types';

const SUPPORTED_GAMES: IGameLoadOrderEntry[] = [];
export function addGameEntry(gameEntry: IGameLoadOrderEntry) {
  if (gameEntry === undefined) {
    log('error', 'unable to add load order page - invalid game entry');
    return;
  }

  const isDuplicate: boolean = SUPPORTED_GAMES.find(game =>
    game.gameId === gameEntry.gameId) !== undefined;

  if (isDuplicate) {
    log('debug', 'attempted to add duplicate gameEntry to load order extension', gameEntry.gameId);
    return;
  }

  SUPPORTED_GAMES.push(gameEntry);
}

export function findGameEntry(gameId: string): IGameLoadOrderEntry {
  return SUPPORTED_GAMES.find(game => game.gameId === gameId);
}
