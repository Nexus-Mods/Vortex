import {IState} from '../../../types/IState';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { ICategoryDictionary } from '../types/ICategoryDictionary';

function createCategoryDetailPath(categories: ICategoryDictionary, category: string,
                                  categoryPath: string, hideTopLevel: boolean, visited: Set<string>) {
  if (!truthy(categories[category])) {
    return null;
  }

  if (!hideTopLevel || (categories[category].parentCategory !== undefined)) {
    categoryPath = (categoryPath === '')
      ? categories[category].name
      : categories[category].name + ' --> ' + categoryPath;
  }

  visited.add(category);

  if ((categories[category].parentCategory !== undefined)
      && !visited.has(categories[category].parentCategory)) {
    return createCategoryDetailPath(categories,
      categories[category].parentCategory, categoryPath, hideTopLevel, visited);
  } else {
    return categoryPath;
  }
}

/**
 * retrieve the Category from the Store returning the full category path.
 *
 * @param {number} category
 * @param {Redux.Store<any>} store
 */
export function resolveCategoryPath(category: string, state: IState) {
  if (!truthy(category)) {
    return null;
  }
  let completePath: string = '';
  const gameId: string = activeGameId(state);

  const categories: ICategoryDictionary = getSafe(state, ['persistent', 'categories', gameId], {});
  const hideTopLevel: boolean = getSafe(state, ['settings', 'interface', 'hideTopLevelCategory'], false);
  if (categories[category] !== undefined) {
    completePath = createCategoryDetailPath(categories, category, '', hideTopLevel, new Set<string>());
  }
  return completePath;

}

export function resolveCategoryId(name: string, state: IState): number {
  const gameId: string = activeGameId(state);

  const categories = state.persistent.categories[gameId];
  const key = Object.keys(categories ?? {})
    .find(iter => categories[iter].name === name);
  if (key !== undefined) {
    return parseInt(key, 10);
  } else {
    return undefined;
  }
}

/**
 * retrieve the Category from the Store
 *
 * @param {number} category
 * @param {Redux.Store<any>} store
 */
export function resolveCategoryName(category: string, state: IState) {
  if (!truthy(category)) {
    return '';
  }

  const gameId: string = activeGameId(state);

  return getSafe(state, ['persistent', 'categories', gameId, category, 'name'], '');
}
