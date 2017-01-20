import { createAction } from 'redux-act';

export const loadCategories: any = createAction('LOAD_CATEGORIES',
(gameId: string, gameCategories) => {
      return { gameId, gameCategories };
    });

export const updateCategories: any = createAction('UPDATE_CATEGORIES',
(gameId: string, gameCategories) => {
      return { gameId, gameCategories };
    });

export const addCategory: any = createAction('ADD_CATEGORY',
(gameId: string, gameCategory) => {
      return { gameId, gameCategory };
    });

export const renameCategory: any = createAction('RENAME_CATEGORY',
(gameId: string, oldCategory: {}, newCategory: {}) => {
      return { gameId, oldCategory, newCategory };
    });

export const removeCategory: any = createAction('REMOVE_CATEGORY',
(gameId: string, category: {}) => {
      return { gameId, category };
    });

export const setTreeDataOrder: any = createAction('SET_TREE_DATA_ORDER',
(gameId: string, treeDataOrder: string[]) => {
      return { gameId, treeDataOrder };
    });
