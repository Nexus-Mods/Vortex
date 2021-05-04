import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { activeGameId } from '../../util/selectors';
import { modLoadOrderReducer } from './reducers/loadOrder';
import { loadOrderSettingsReducer } from './reducers/settings';
import { IGameLoadOrderEntry } from './types/types';
import LoadOrderPage from './views/LoadOrderPage';

import { addGameEntry, findGameEntry, initCollectionsSupport } from './gameSupport';

export default function init(context: IExtensionContext) {
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

  context.registerReducer(['persistent', 'loadOrder'], modLoadOrderReducer);
  context.registerReducer(['settings', 'loadOrder'], loadOrderSettingsReducer);

  context.once(() => {
    initCollectionsSupport(context.api);
  });

  return true;
}
