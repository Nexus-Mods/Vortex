import {IExtensionContext} from '../../types/IExtensionContext';
import {IState} from '../../types/IState';
import { TFunction } from '../../util/i18n';
import {log} from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';

import { setDownloadModInfo } from '../download_management/actions/state';
import { setModAttribute } from '../mod_management/actions/mods';
import { IModWithState } from '../mod_management/types/IModProps';

import { loadCategories, updateCategories } from './actions/category';
import { showCategoriesDialog } from './actions/session';
import {categoryReducer} from './reducers/category';
import { sessionReducer } from './reducers/session';
import { allCategories } from './selectors';
import { ICategoryDictionary } from './types/ICategoryDictionary';
import { ICategoriesTree } from './types/ITrees';
import CategoryFilter from './util/CategoryFilter';
import { resolveCategoryName, resolveCategoryPath } from './util/retrieveCategoryPath';
import CategoryDialog from './views/CategoryDialog';

import i18next from 'i18next';
import * as Redux from 'redux';

// export for api
export { resolveCategoryName, resolveCategoryPath };

function getModCategory(mod: IModWithState) {
  return getSafe(mod, ['attributes', 'category'], undefined);
}

function getModName(mod: IModWithState) {
  return (getSafe(mod, ['attributes', 'name'], undefined))
      || (getSafe(mod, ['attributes', 'fileName'], undefined));
}

function getCategoryChoices(state: IState) {
  const categories: ICategoryDictionary = allCategories(state);

  return [ {key: '', text: ''} ].concat(
    Object.keys(categories)
      .map(id => ({ key: id, text: resolveCategoryPath(id, state) }))
      .sort((lhs, rhs) => categories[lhs.key].order - categories[rhs.key].order));
}

function undefSort(lhs: any, rhs: any) {
  return (lhs !== undefined)
    ? 1 : (rhs !== undefined)
            ? -1 : 0;
}

function modNameSort(lhs: IModWithState, rhs: IModWithState,
                     collator: Intl.Collator, sortDir: string): number {
  const lhsName = getModName(lhs);
  const rhsName = getModName(rhs);
  return ((lhsName === undefined) || (rhsName === undefined))
    ? undefSort(lhsName, rhsName)
    : collator.compare(lhsName, rhsName) * (sortDir !== 'desc' ? 1 : -1);
}

function sortCategories(lhs: IModWithState, rhs: IModWithState,
                        collator: Intl.Collator, state: any, sortDir: string): number {
  const lhsCat = resolveCategoryName(getModCategory(lhs), state);
  const rhsCat = resolveCategoryName(getModCategory(rhs), state);
  return (lhsCat === rhsCat)
    ? modNameSort(lhs, rhs, collator, sortDir)
    : collator.compare(lhsCat, rhsCat);
}

function init(context: IExtensionContext): boolean {
  let sortDirection: string = 'none';
  let lang: string;
  let collator: Intl.Collator;
  const getCollator = (locale: string) => {
    if ((collator === undefined) || (locale !== lang)) {
      lang = locale;
      collator = new Intl.Collator(locale, { sensitivity: 'base' });
    }
    return collator;
  };

  context.registerReducer(['persistent', 'categories'], categoryReducer);
  context.registerReducer(['session', 'categories'], sessionReducer);

  context.registerDialog('categories', CategoryDialog);
  context.registerAction('mod-icons', 80, 'categories', {}, 'Categories', () => {
    context.api.store.dispatch(showCategoriesDialog(true));
  });

  context.registerTableAttribute('mods', {
    id: 'category',
    name: 'Category',
    description: 'Mod Category',
    icon: 'sitemap',
    placement: 'table',
    calc: (mod: IModWithState) =>
      resolveCategoryName(getModCategory(mod), context.api.store.getState()),
    isToggleable: true,
    edit: {},
    isSortable: true,
    isGroupable: (mod: IModWithState, t: TFunction) =>
      resolveCategoryName(getModCategory(mod), context.api.store.getState()) || t('<No category>'),
    filter: new CategoryFilter(),
    sortFuncRaw: (lhs: IModWithState, rhs: IModWithState, locale: string): number =>
      sortCategories(lhs, rhs, getCollator(locale), context.api.store.getState(), sortDirection),
  });

  context.registerTableAttribute('mods', {
    id: 'category-detail',
    name: 'Category',
    description: 'Mod Category',
    icon: 'sitemap',
    supportsMultiple: true,
    calc: (mod: IModWithState) =>
      resolveCategoryPath(getModCategory(mod), context.api.store.getState()),
    edit: {
      choices: () => getCategoryChoices(context.api.store.getState()),
      onChangeValue: (rows: IModWithState[], newValue: any) => {
        const gameMode = activeGameId(context.api.store.getState());
        rows.forEach(row => {
          if (row.state === 'downloaded') {
            context.api.store.dispatch(
              setDownloadModInfo(row.id, 'custom.category', newValue));
          } else {
            context.api.store.dispatch(
                setModAttribute(gameMode, row.id, 'category', newValue));
          }
        });
      },
    },
    placement: 'detail',
    isToggleable: false,
    isSortable: true,
  });

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;
    context.api.onStateChange(['settings', 'tables', 'mods'],
      (oldState, newState) => {
        const newSortDirection =
          getSafe(newState, ['attributes', 'category', 'sortDirection'], 'none');

        const oldSortDirection =
          getSafe(oldState, ['attributes', 'category', 'sortDirection'], 'none');

        if (newSortDirection !== oldSortDirection) {
          sortDirection = newSortDirection;
        }
    });
    try {
      context.api.events.on('update-categories', (gameId, categories, isUpdate) => {
        if (isUpdate) {
          context.api.store.dispatch(updateCategories(gameId, categories));
        } else {
          context.api.store.dispatch(loadCategories(gameId, categories));
        }
      });

      context.api.events.on('gamemode-activated', (gameMode: string) => {
        const categories: ICategoriesTree[] = getSafe(store.getState(),
          ['persistent', 'categories', gameMode], undefined);
        const APIKEY = getSafe(store.getState(),
          ['confidential', 'account', 'nexus', 'APIKey'], undefined);
        if (categories === undefined && APIKEY !== undefined) {
          context.api.events.emit('retrieve-category-list', false, {});
        } else if (categories !== undefined && categories.length === 0) {
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
