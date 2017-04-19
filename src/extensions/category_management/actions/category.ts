import safeCreateAction from '../../../actions/safeCreateAction';
import {ICategoryDictionary} from '../types/ICategoryDictionary';

export const loadCategories = safeCreateAction('LOAD_CATEGORIES',
  (gameId: string, gameCategories: ICategoryDictionary) =>
    ({ gameId, gameCategories }));

export const updateCategories = safeCreateAction('UPDATE_CATEGORIES',
  (gameId: string, gameCategories: ICategoryDictionary) =>
    ({ gameId, gameCategories }));

export const renameCategory = safeCreateAction('RENAME_CATEGORY',
(gameId: string, categoryId: string, name: string) =>
    ({ gameId, categoryId, name }));
