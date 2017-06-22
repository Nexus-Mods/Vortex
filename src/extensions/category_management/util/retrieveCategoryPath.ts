import {IState} from '../../../types/IState';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

function createCategoryDetailPath(categories: any, category: string,
                                  categoryPath: string) {
  categoryPath = (categoryPath === '')
    ? categories[category].name
    : categories[category].name + ' --> ' + categoryPath;

  if (categories[category].parentCategory !== undefined) {
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
export function retrieveCategoryDetail(category: string, state: IState) {
  if (category === undefined) {
    return null;
  }
  let completePath: string = '';
  const gameId: string = activeGameId(state);

  const categories: any = getSafe(state, ['persistent', 'categories', gameId], '');
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
export function retrieveCategory(category: string, store: any) {
  if (category === undefined) {
    return null;
  }

  const gameId: string = activeGameId(store.getState());

  const categories: any = getSafe(store.getState(), ['persistent', 'categories',
    gameId], '');
  return categories[category] !== undefined ? categories[category].name : '';
}
