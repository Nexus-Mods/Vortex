import { modLoadOrderReducer } from './reducers/loadOrder';
import { loadOrderSettingsReducer } from './reducers/settings';
import { IGameLoadOrderEntry } from './types/types';
import LoadOrderPage from './views/LoadOrderPage';

import { log, selectors, types } from 'vortex-api';

const SUPPORTED_GAMES: IGameLoadOrderEntry[] = [];

export interface IExtensionContextExt extends types.IExtensionContext {
  // Provides game extensions with an easy way to add a load order page
  //  if they require it.
  registerLoadOrderPage: (gameEntry: IGameLoadOrderEntry) => void;
}

export default function init(context: IExtensionContextExt) {
  context.registerMainPage('sort-none', 'Load Order', LoadOrderPage, {
    id: 'generic-loadorder',
    hotkey: 'E',
    group: 'per-game',
    visible: () => {
      const currentGameId: string = selectors.activeGameId(context.api.store.getState());
      const gameEntry: IGameLoadOrderEntry = findGameEntry(currentGameId);
      return (gameEntry !== undefined) ? true : false;
    },
    priority: 120,
    props: () => {
      return {
        getGameEntry: (gameId) => findGameEntry(gameId),
      };
    },
  });

  context.registerLoadOrderPage = (gameEntry: IGameLoadOrderEntry) => {
    addGameEntry(gameEntry);
  };

  context.registerReducer(['persistent', 'loadOrder'], modLoadOrderReducer);
  context.registerReducer(['settings', 'loadOrder'], loadOrderSettingsReducer);

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
