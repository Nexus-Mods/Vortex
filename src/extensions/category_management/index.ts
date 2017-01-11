import { loadCategories, updateCategories } from './actions/category';
import { setTreeDataObject } from './actions/session';
import { categoryReducer } from './reducers/category';
import { sessionReducer } from './reducers/session';
import CategoryList from './views/CategoryList';

import { convertGameId } from './util/convertGameId';
import { retrieveCategoryPath } from './util/retrieveCategoryPath';

import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { getSafe } from '../../util/storeHelper';

function init(context: IExtensionContext): boolean {
  context.registerMainPage('book', 'Categories', CategoryList, {
    hotkey: 'C',
  });

  context.registerReducer(['persistent', 'categories'], categoryReducer);
  context.registerReducer(['session', 'categories'], sessionReducer);

  context.registerTableAttribute('mods', {
    id: 'category',
    name: 'Category',
    description: 'Category',
    icon: 'book',
    placement: 'table',
    calc: (mod) => retrieveCategoryPath(mod.attributes.category, context.api.store, null, false),
    isToggleable: true,
    isReadOnly: false,
    isSortable: true,
  });

  context.registerTableAttribute('mods', {
    id: 'category_detail',
    name: 'Category Detail',
    description: 'Category Detail',
    icon: 'angle-double-right',
    calc: (mod) => retrieveCategoryPath(mod.attributes.category, context.api.store, null, true),
    placement: 'detail',
    isToggleable: false,
    isReadOnly: false,
    isSortable: true,
  });

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    try {

      context.api.events.on('retrieve-categories', (result) => {
        let isUpdate = result[2];
        let categories = result[1];
        let gameId = result[0];

        if (isUpdate) {
          context.api.store.dispatch(updateCategories(gameId, categories));
          store.dispatch(setTreeDataObject(categories));
        } else {
          context.api.store.dispatch(loadCategories(gameId, categories));
        }
      });

      context.api.events.on('gamemode-activated', (gameMode: string) => {
        let categories: any = getSafe(store.getState(), ['persistent', 'categories',
          convertGameId(gameMode)], '');
        store.dispatch(setTreeDataObject(undefined));
        if (categories === undefined) {
          context.api.events.emit('retrieve-category-list', false, {});
        }
      });

    } catch (err) {
      log('error', 'Failed to load categories', err);
      showError(store.dispatch, 'Failed to load categories', err);
    }
  });

  return true;
}

export default init;
