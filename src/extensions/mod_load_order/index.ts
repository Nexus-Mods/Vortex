import * as path from 'path';
import { IGameLoadOrderEntry, ILoadOrder } from './types/types';
import LoadOrderPage from './views/LoadOrderPage';

import { log, selectors, types, util } from 'vortex-api';

const SUPPORTED_GAMES: IGameLoadOrderEntry[] = [];

export default function init(context: types.IExtensionContext) {
  context.registerMainPage('sort-none', 'Load Order', LoadOrderPage, {
    id: 'generic-loadorder',
    hotkey: 'E',
    group: 'per-game',
    visible: () => {
      const currentGameId: string = selectors.activeGameId(context.api.store.getState());
      const gameEntry: IGameLoadOrderEntry = findGameEntry(currentGameId);
      return (gameEntry !== undefined) ? true : false;
    },
    props: () => {
      return {
        getGameEntry: (gameId) => findGameEntry(gameId),
      };
    },
  });

  context.once(() => {
    context.api.events.on('add-loadorder-game', (gameEntry: IGameLoadOrderEntry) =>
      addGameEntry(gameEntry));

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      const gameEntry: IGameLoadOrderEntry = findGameEntry(gameMode);
      if (gameEntry !== undefined) {
        // Do stuff
      }
    });

    context.api.setStylesheet('modloadorder', path.join(__dirname, 'modloadorder.scss'));
  });

  return true;
}

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

function findGameEntry(gameId: string): IGameLoadOrderEntry {
  return SUPPORTED_GAMES.find(game => game.gameId === gameId);
}
