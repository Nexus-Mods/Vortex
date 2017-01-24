import safeCreateAction from '../../../actions/safeCreateAction';

export const loadCategories: any = safeCreateAction('LOAD_CATEGORIES',
(gameId: string, gameCategories) => {
      return { gameId, gameCategories };
    });

export const updateCategories: any = safeCreateAction('UPDATE_CATEGORIES',
(gameId: string, gameCategories) => {
      return { gameId, gameCategories };
    });

export const renameCategory: any = safeCreateAction('RENAME_CATEGORY',
(gameId: string, oldCategory, newCategory) => {
      return { gameId, oldCategory, newCategory };
    });
