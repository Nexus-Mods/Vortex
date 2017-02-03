import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

function createCategoryDetailPath(categories: any, category: string, categoryPath: string) {
  if (categoryPath === '') {
    categoryPath = categories[category].name;
  } else {
    categoryPath = categories[category].name + ' --> ' + categoryPath;
  }

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
export function retrieveCategoryDetail(
  category: string,
  store: any) {
  let completePath: string = '';
  let gameId: string = activeGameId(store.getState());

  let categories: any = getSafe(store.getState(), ['persistent', 'categories',
    gameId], '');
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

export function retrieveCategory(
  category: number,
  store: any) {

  let gameId: string = activeGameId(store.getState());

  let categories: any = getSafe(store.getState(), ['persistent', 'categories',
    gameId], '');
  return categories[category] !== undefined ? categories[category].name : '';

}
