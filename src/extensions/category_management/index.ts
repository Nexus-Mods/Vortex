import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';

import { setModAttribute } from '../mod_management/actions/mods';
import { IModWithState } from '../mod_management/types/IModProps';

import { loadCategories, updateCategories } from './actions/category';
import { showCategoriesDialog } from './actions/session';
import {categoryReducer} from './reducers/category';
import { sessionReducer } from './reducers/session';
import { allCategories } from './selectors';
import { ICategoryDictionary } from './types/IcategoryDictionary';
import { ICategoriesTree } from './types/ITrees';
import CategoryFilter from './util/CategoryFilter';
import { retrieveCategory, retrieveCategoryDetail } from './util/retrieveCategoryPath';
import CategoryDialog from './views/CategoryDialog';

function init(context: IExtensionContext): boolean {
  context.registerDialog('categories', CategoryDialog);
  context.registerIcon('mod-icons', 100, 'sitemap', 'Categories', () => {
    context.api.store.dispatch(showCategoriesDialog(true));
  });

  context.registerReducer(['persistent', 'categories'], categoryReducer);
  context.registerReducer(['session', 'categories'], sessionReducer);

  context.registerTableAttribute('mods', {
    id: 'category',
    name: 'Category',
    description: 'Mod Category',
    icon: 'book',
    placement: 'table',
    calc: (mod: IModWithState) => mod.attributes['category'] !== undefined ?
        retrieveCategory(mod.attributes['category'], context.api.store) : null,
    isToggleable: true,
    edit: {},
    isSortable: true,
    filter: new CategoryFilter(),
  });

  context.registerTableAttribute('mods', {
    id: 'category_detail',
    name: 'Category',
    description: 'Mod Category',
    icon: 'angle-double-right',
    calc: (mod: IModWithState) => mod.attributes['category'] !== undefined ?
      retrieveCategoryDetail(mod.attributes['category'], context.api.store) : null,
    edit: {
      choices: () => {
        const store = context.api.store;
        const categories: ICategoryDictionary = allCategories(store.getState());
        const treeDataOrder: string[] = Object.keys(categories)
          .map((id: string) => {
            return categories[id].order.toString();
          });

        const language: string = store.getState().settings.interface.language;
        if (treeDataOrder === undefined) {
          return [{ key: '', text: '' }].concat(Object.keys(categories)
            .map((id: string) => ({ key: id, text: retrieveCategoryDetail(id, context.api.store) }))
            .sort((lhs, rhs) => {
              return lhs.text.localeCompare(rhs.text, language);
            }));
        } else {
          return [{ key: '', text: '' }].concat(Object.keys(categories)
            .map((id: string) => ({ key: id, text: retrieveCategoryDetail(id, context.api.store) }))
            .sort((lhs, rhs) => (categories[lhs.key].order - categories[rhs.key].order )));
        }
      },
      onChangeValue: (rowId: string, newValue: any) => {
        const gameMode = activeGameId(context.api.store.getState());
        context.api.store.dispatch(setModAttribute(gameMode, rowId, 'category', newValue));
      },
    },
    placement: 'detail',
    isToggleable: false,
    isSortable: true,
  });

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    try {
      context.api.events.on('retrieve-categories', (gameId, categories, isUpdate) => {
        if (isUpdate) {
          context.api.store.dispatch(updateCategories(gameId, categories));
        } else {
          context.api.store.dispatch(loadCategories(gameId, categories));
        }
      });

      context.api.events.on('gamemode-activated', (gameMode: string) => {
        let categories: ICategoriesTree[] = getSafe(store.getState(),
          ['persistent', 'categories', gameMode], undefined);
        if (categories === undefined) {
          context.api.events.emit('retrieve-category-list', false, {});
        } else if (categories.length === 0) {
          context.api.store.dispatch(updateCategories(gameMode, {}));
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
