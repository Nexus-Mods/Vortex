import CategoryList from './views/CategoryList';

import { IExtensionContext } from '../../types/IExtensionContext';
import { loadCategories, updateCategories } from './actions/category';
import { setTreeDataObject } from './actions/session';

import { categoryReducer } from './reducers/category';
import { sessionReducer } from './reducers/session';
import { ICategory } from './types/ICategory';
import { IGameListEntry } from './types/IGameListEntry';

import { getSafe } from '../../util/storeHelper';

import { retriveCategoryList } from './util/retrieveCategories';

import Nexus from 'nexus-api';

import { convertGameId } from './util/convertGameId';

import { log } from '../../util/log';

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
      let state = context.api.store.getState();
      nexus = new Nexus(
        getSafe(state, ['settings', 'gameMode', 'current'], ''),
        getSafe(state, ['account', 'nexus', 'APIKey'], '')
      );

      context.api.events.on('gamemode-activated', (gameMode: string) => {

        context.api.store.dispatch(setTreeDataObject(undefined));
        let gameId = convertGameId(gameMode);
        retriveCategories(gameId, context, false);
      });

    } catch (err) {
      log('error', 'Failed to load categories', err);
    }
  });

  return true;
}

function retriveCategories(
  activeGameId: string,
  context: IExtensionContext,
  isUpdate: boolean): any {

  if (isUpdate) {
    retriveCategoryList(activeGameId, nexus, isUpdate)
      .then((result: any) => {
        context.api.store.dispatch(updateCategories(activeGameId, result));
      });
  } else {
    retriveCategoryList(activeGameId, nexus, isUpdate)
      .then((result: any) => {
        context.api.store.dispatch(loadCategories(activeGameId, result));
      });
  }
}

export default init;
