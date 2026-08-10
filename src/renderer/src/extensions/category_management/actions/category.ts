import { createAction } from "redux-act";

import type { ICategory, ICategoryDictionary } from "../types/ICategoryDictionary";

export const loadCategories = createAction(
  "LOAD_CATEGORIES",
  (gameId: string, gameCategories: ICategoryDictionary) => ({
    gameId,
    gameCategories,
  }),
);

export const setCategory = createAction(
  "SET_CATEGORY",
  (gameId: string, id: string, category: ICategory) => ({
    gameId,
    id,
    category,
  }),
);

export const removeCategory = createAction("REMOVE_CATEGORY", (gameId: string, id: string) => ({
  gameId,
  id,
}));

export const setCategoryOrder = createAction(
  "SET_CATEGORY_ORDER",
  (gameId: string, categoryIds: string[]) => ({ gameId, categoryIds }),
);

export const updateCategories = createAction(
  "UPDATE_CATEGORIES",
  (gameId: string, gameCategories: ICategoryDictionary) => ({
    gameId,
    gameCategories,
  }),
);

export const renameCategory = createAction(
  "RENAME_CATEGORY",
  (gameId: string, categoryId: string, name: string) => ({
    gameId,
    categoryId,
    name,
  }),
);
