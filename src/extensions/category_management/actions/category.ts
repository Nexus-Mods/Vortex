import { createAction } from 'redux-act';

import { IChildren } from '../types/ICategoryTree';

export const loadCategories: any = createAction('LOAD_CATEGORIES',
(gameId: string, categories) => {
      return { gameId, categories };
    });

/*
export const removeCategory: any = createAction('REMOVE_CATEGORY',
    (gameId: string, categories: IChildren) => {
      return { gameId, categories };
    });
    */

export const addCategory: any = createAction('ADD_CATEGORY');

export const removeCategory: any = createAction('REMOVE_CATEGORY',
(gameId: string, rootId: string, category: IChildren) => {
      return { gameId, rootId, category };
    });
