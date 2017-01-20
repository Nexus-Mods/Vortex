
import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { getSafe } from '../../util/storeHelper';

import { setModAttribute } from '../mod_management/actions/mods';

import { loadCategories, setTreeDataOrder, updateCategories } from './actions/category';
import { setTreeDataObject } from './actions/session';
import { categoryReducer } from './reducers/category';
import { sessionReducer } from './reducers/session';
import { allCategories } from './selectors';
import { ICategoryDictionary } from './types/IcategoryDictionary';
import { ITreeDataObject } from './types/ITrees';
import createTreeDataObject from './util/createTreeDataObject';
import { retrieveCategory, retrieveCategoryDetail } from './util/retrieveCategoryPath';
import CategoryList from './views/CategoryList';

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
    calc: (mod) => mod.attributes.category !== undefined ?
      retrieveCategory(mod.attributes.category, context.api.store) : null,
    isToggleable: true,
    edit: {},
    isSortable: true,
  });

  context.registerTableAttribute('mods', {
    id: 'category_detail',
    name: 'Category Detail',
    description: 'Category Detail',
    icon: 'angle-double-right',
    calc: (mod) => mod.attributes.category !== undefined ?
      retrieveCategoryDetail(mod.attributes.category, context.api.store) : null,
    edit: {
      choices: () => {
        const store = context.api.store;
        const categories: ICategoryDictionary = allCategories(store.getState());
        const treeDataOrder = getSafe(store.getState(),
          ['persistent', 'categories', 'treeDataOrder'], []);
        const gameMode = getSafe(store.getState(),
          ['settings', 'gameMode', 'current'], []);

        if (treeDataOrder === undefined) {
          let dataOrder: string[] = [];
          Object.keys(categories).forEach((key: string) => {
            dataOrder.push(key);
          });

          store.dispatch(setTreeDataOrder(gameMode, dataOrder));
        }

        const language: string = store.getState().settings.interface.language;
        if (treeDataOrder === undefined) {
          return [{ key: '', text: '' }].concat(Object.keys(categories)
            .map((id: string) => ({ key: id, text: retrieveCategoryDetail(id, context.api.store) }))
            .sort((lhs, rhs) => {
              return lhs.text.localeCompare(rhs.text, language);
            }));
        } else {
          return [{ key: '', text: '' }].concat(treeDataOrder
            .map((id: string) => ({ key: id, text: retrieveCategoryDetail(id, context.api.store) }))
          );
        }
      },
      onChangeValue: (rowId: string, newValue: any) => {
        context.api.store.dispatch(setModAttribute(rowId, 'category', newValue));
      },
    },
    placement: 'detail',
    isToggleable: false,
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

          const treeDataOrder = getSafe(store.getState(),
            ['persistent', 'categories', gameId, 'treeDataOrder'], []);

          let mods: any = getSafe(store.getState(), ['mods'], '');
          store.dispatch(setTreeDataObject(createTreeDataObject(categories, mods.mods, false)));

          if (treeDataOrder[0] === undefined) {
            let dataOrder: string[] = [];
            Object.keys(categories).forEach((key: string) => {
              dataOrder.push(key);
            });

            store.dispatch(setTreeDataOrder(gameId, dataOrder));
          }

        } else {
          context.api.store.dispatch(loadCategories(gameId, categories));
        }
      });

      context.api.events.on('gamemode-activated', (gameMode: string) => {
        let categories: ITreeDataObject[] = getSafe(store.getState(), ['persistent', 'categories',
          gameMode], []);

        let treeDataOrder = getSafe(store.getState(), ['persistent', 'categories',
          gameMode, 'treeDataOrder'], '');

        if (treeDataOrder === undefined) {
          let treeDataOrder: string[] = [];
          Object.keys(categories).forEach((key: string) => {
            treeDataOrder.push(key);
          });

          store.dispatch(setTreeDataOrder(gameMode, treeDataOrder));
        }

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
