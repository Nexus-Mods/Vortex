import { convertGameId } from './convertGameId';

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

export function retrieveCategoryDetail(
  category: string,
  store: any) {
  let completePath: string = '';
  let gameId: string = convertGameId(getSafe(store.getState(),
    ['settings', 'gameMode', 'current'], ''));

  let categories: any = getSafe(store.getState(), ['persistent', 'categories',
    gameId, 'gameCategories'], '');
  if (categories[category] !== undefined) {
    completePath = createCategoryDetailPath(categories, category, '');
  }
  return completePath;

}

export function retrieveCategory(
  category: number,
  store: any) {

  let gameId: string = convertGameId(getSafe(store.getState(),
    ['settings', 'gameMode', 'current'], ''));

  let categories: any = getSafe(store.getState(), ['persistent', 'categories',
    gameId, 'gameCategories'], '');
  return categories[category] !== undefined ? categories[category].name : '';

}
