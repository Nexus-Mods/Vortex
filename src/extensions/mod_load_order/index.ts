import { IExtensionContext } from '../../types/IExtensionContext';
import { IMod, IState } from '../../types/IState';
import { activeGameId } from '../profile_management/activeGameId';
import { installPathForGame } from '../mod_management/selectors';
import { modLoadOrderReducer } from './reducers/loadOrder';
import { loadOrderSettingsReducer } from './reducers/settings';
import { IGameLoadOrderEntry } from './types/types';
import LoadOrderPage from './views/LoadOrderPage';

import { ICollection } from './types/collections';

import { getSafe } from '../../util/storeHelper';

import { generate, Interface, parser } from './collections/loadOrder';

import { addGameEntry, findGameEntry } from './gameSupport';

export default function init(context: IExtensionContext) {
  context.registerReducer(['persistent', 'loadOrder'], modLoadOrderReducer);
  context.registerReducer(['settings', 'loadOrder'], loadOrderSettingsReducer);

  context.registerMainPage('sort-none', 'Load Order', LoadOrderPage, {
    id: 'generic-loadorder',
    hotkey: 'E',
    group: 'per-game',
    visible: () => {
      const currentGameId: string = activeGameId(context.api.store.getState());
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

  context.optional.registerCollectionFeature(
    'generic_load_order_collection_data',
    (gameId: string, includedMods: string[]) => {
      const state = context.api.getState();
      const stagingPath = installPathForGame(state, gameId);
      const mods: { [modId: string]: IMod } =
        getSafe(state, ['persistent', 'mods', gameId], {});
      return generate(context.api, state, gameId, stagingPath, includedMods, mods);
    },
    (gameId: string, collection: ICollection) => parser(context.api, gameId, collection),
    () => Promise.resolve(),
    (t) => t('Load Order'),
    (state: IState, gameId: string) => {
      const gameEntry: IGameLoadOrderEntry = findGameEntry(gameId);
      if (gameEntry === undefined) {
        return false;
      }
      return !(gameEntry.noCollectionGeneration ?? false);
    },
    Interface,
  );

  return true;
}
