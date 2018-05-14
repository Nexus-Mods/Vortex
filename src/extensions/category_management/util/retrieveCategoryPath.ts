import {IState} from '../../../types/IState';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

function createCategoryDetailPath(categories: any, category: string,
                                  categoryPath: string, visited: Set<string> = new Set()) {
  if (categories[category] === undefined) {
    return null;
  }
  categoryPath = (categoryPath === '')
    ? categories[category].name
    : categories[category].name + ' --> ' + categoryPath;

  visited.add(category);

  if ((categories[category].parentCategory !== undefined)
      && !visited.has(categories[category].parentCategory)) {
    return createCategoryDetailPath(categories,
      categories[category].parentCategory, categoryPath);
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
  if (category === undefined) {
    return null;
  }
  let completePath: string = '';
  const gameId: string = activeGameId(state);

  const categories: any = getSafe(state, ['persistent', 'categories', gameId], {});
  if (categories[category] !== undefined) {
    completePath = createCategoryDetailPath(categories, category, '');
  }
  return completePath;

}

/**
 * retrieve the Category from the Store
 *
 * @param {number} category
 * @param {Redux.Store<any>} store
 */
export function resolveCategoryName(category: string, state: IState) {
  if (category === undefined) {
    return '';
  }

  const gameId: string = activeGameId(state);

  return getSafe(state, ['persistent', 'categories', gameId, category, 'name'], '');
}
