
import { log } from '../../util/log';
import { checkAndLogDuplicateGameEntry } from '../loadOrderUtils';

import { IGameLoadOrderEntry } from './types/types';

const SUPPORTED_GAMES: IGameLoadOrderEntry[] = [];
export function addGameEntry(gameEntry: IGameLoadOrderEntry) {
  if (gameEntry === undefined) {
    log('error', 'unable to add load order page - invalid game entry');
    return;
  }

  if (checkAndLogDuplicateGameEntry(gameEntry.gameId, SUPPORTED_GAMES, 'mod_load_order')) {
    return;
  }

  SUPPORTED_GAMES.push(gameEntry);
}

export function findGameEntry(gameId: string): IGameLoadOrderEntry {
  return SUPPORTED_GAMES.find(game => game.gameId === gameId);
}
