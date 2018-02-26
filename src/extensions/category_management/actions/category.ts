import safeCreateAction from '../../../actions/safeCreateAction';
import {ICategory, ICategoryDictionary} from '../types/ICategoryDictionary';

import * as reduxAct from 'redux-act';

export const loadCategories = safeCreateAction('LOAD_CATEGORIES',
  (gameId: string, gameCategories: ICategoryDictionary) =>
    ({ gameId, gameCategories }));

export const setCategory = safeCreateAction('SET_CATEGORY',
  (gameId: string, id: string, category: ICategory) => ({ gameId, id, category }));

export const removeCategory = safeCreateAction('REMOVE_CATEGORY',
  (gameId: string, id: string) => ({ gameId, id }));

export const setCategoryOrder = safeCreateAction('SET_CATEGORY_ORDER',
  (gameId: string, categoryIds: string[]) => ({ gameId, categoryIds }));

export const updateCategories = safeCreateAction('UPDATE_CATEGORIES',
  (gameId: string, gameCategories: ICategoryDictionary) =>
    ({ gameId, gameCategories }));

export const renameCategory = safeCreateAction('RENAME_CATEGORY',
(gameId: string, categoryId: string, name: string) =>
    ({ gameId, categoryId, name }));
