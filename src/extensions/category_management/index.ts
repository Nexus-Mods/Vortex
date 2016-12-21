import { loadCategories, updateCategories } from './actions/category';
import { setTreeDataObject } from './actions/session';
import { categoryReducer } from './reducers/category';
import { sessionReducer } from './reducers/session';
import { ICategory } from './types/ICategory';
import { IGameListEntry } from './types/IGameListEntry';
import { convertGameId } from './util/convertGameId';
import { retriveCategoryList } from './util/retrieveCategories';
import CategoryList from './views/CategoryList';

import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { getSafe } from '../../util/storeHelper';


import Nexus from 'nexus-api';

interface IGameInfo extends IGameListEntry {
  categories: ICategory[];
}

let nexus: Nexus;

function init(context: IExtensionContext): boolean {
  context.registerMainPage('book', 'Categories', CategoryList, {
    hotkey: 'C',
  });

  context.registerReducer(['persistent', 'categories'], categoryReducer);
  context.registerReducer(['session', 'categories'], sessionReducer);

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    try {
      let state = store.getState();
      nexus = new Nexus(
        getSafe(state, ['settings', 'gameMode', 'current'], ''),
        getSafe(state, ['account', 'nexus', 'APIKey'], '')
      );

      context.api.events.on('gamemode-activated', (gameMode: string) => {

        store.dispatch(setTreeDataObject(undefined));
        let gameId = convertGameId(gameMode);
        retriveCategories(gameId, context, false);
      });

    } catch (err) {
      log('error', 'Failed to load categories', err);
      showError(store.dispatch, 'Failed to load categories', err);
    }
  });

  return true;
}

function retriveCategories(
  activeGameId: string,
  context: IExtensionContext,
  isUpdate: boolean): any {

  retriveCategoryList(activeGameId, nexus, isUpdate)
    .then((result: any) => {
      if (isUpdate) {
        context.api.store.dispatch(updateCategories(activeGameId, result));
      } else {
        context.api.store.dispatch(loadCategories(activeGameId, result));
      }
    })
    .catch((err) => {
      showError(context.api.store.dispatch,
        'An error occurred retrieving the Game Info', err);
    });
}

export default init;
