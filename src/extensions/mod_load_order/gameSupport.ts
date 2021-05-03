
import * as types from '../../types/api';
import { log } from '../../util/log';

import { generate, Interface, parser } from './collections/loadOrder';
import { ICollectionsGameSupportEntry } from './types/collections';
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

export function initCollectionsSupport(api: types.IExtensionApi) {
  if (api.ext.addGameSpecificCollectionsData !== undefined) {
    for (const game of SUPPORTED_GAMES) {
      if (game.noCollectionGeneration === true) {
        continue;
      }
      const collectionsSupportEntry: ICollectionsGameSupportEntry = {
        gameId: game.gameId,
        generator: (state, gameId, stagingPath, modIds, mods) =>
          generate(api, state, gameId, stagingPath, modIds, mods),
        parser,
        interface: Interface,
      };
      api.ext.addGameSpecificCollectionsData(collectionsSupportEntry as any);
    }
  }
}
