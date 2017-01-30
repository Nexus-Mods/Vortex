import safeCreateAction from '../../../actions/safeCreateAction';
import {ICategoryDictionary} from '../types/ICategoryDictionary';

export const loadCategories: any = safeCreateAction('LOAD_CATEGORIES',
(gameId: string, gameCategories: ICategoryDictionary) => {
      return { gameId, gameCategories };
    });

export const updateCategories: any = safeCreateAction('UPDATE_CATEGORIES',
(gameId: string, gameCategories: ICategoryDictionary) => {
      return { gameId, gameCategories };
    });

export const renameCategory: any = safeCreateAction('RENAME_CATEGORY',
(gameId: string, categoryId: string, name: string) => {
      return { gameId, categoryId, name };
    });
