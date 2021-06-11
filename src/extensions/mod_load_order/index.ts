import { IExtensionContext } from '../../types/IExtensionContext';
import { activeGameId, installPathForGame } from '../../util/selectors';
import { modLoadOrderReducer } from './reducers/loadOrder';
import { loadOrderSettingsReducer } from './reducers/settings';
import { IGameLoadOrderEntry } from './types/types';
import LoadOrderPage from './views/LoadOrderPage';

import { ICollection } from './types/collections';

import { getSafe } from '../../util/storeHelper';

import { generate, Interface, parser } from './collections/loadOrder';

import { addGameEntry, findGameEntry } from './gameSupport';
import { types } from '../..';

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

  context['registerCollectionFeature'](
    'generic_load_order_collection_data',
    (gameId: string, includedMods: string[]) => {
      const state = context.api.getState();
      const stagingPath = installPathForGame(state, gameId);
      const mods: { [modId: string]: types.IMod } =
        getSafe(state, ['persistent', 'mods', gameId], {});
      return generate(context.api, state, gameId, stagingPath, includedMods, mods);
    },
    (gameId: string, collection: ICollection) => parser(context.api, gameId, collection),
    (t) => t('Load Order'),
    (state: types.IState, gameId: string) => (findGameEntry(gameId) !== undefined),
    Interface,
  );

  return true;
}
