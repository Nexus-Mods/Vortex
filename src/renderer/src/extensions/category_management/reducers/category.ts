import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/category";
import type { ICategoryState } from "../types/ICategoryDictionary";

/**
 * reducer for changes to the categories (persistent.categories, keyed by game id)
 */
export const categoryReducer = actionsToReducerSpec<ICategoryState, typeof actions>(
  {},
  actions,
  {
    loadCategories: (state, payload) => ({ ...state, [payload.gameId]: payload.gameCategories }),
    setCategory: (state, payload) => ({
      ...state,
      [payload.gameId]: { ...state[payload.gameId], [payload.id]: payload.category },
    }),
    removeCategory: (state, payload) => {
      const { gameId, id } = payload;
      const categories = state[gameId];
      if (categories === undefined || !Object.hasOwn(categories, id)) {
        return state;
      }
      const { [id]: _, ...rest } = categories;
      return { ...state, [gameId]: rest };
    },
    updateCategories: (state, payload) => ({
      ...state,
      [payload.gameId]: payload.gameCategories,
    }),
    renameCategory: (state, payload) => {
      const { gameId, categoryId, name } = payload;
      const category = state[gameId]?.[categoryId];
      if (category === undefined) {
        return state;
      }
      return { ...state, [gameId]: { ...state[gameId], [categoryId]: { ...category, name } } };
    },
    setCategoryOrder: (state, payload) => {
      const { gameId, categoryIds } = payload;
      let newState = state;
      categoryIds.forEach((id, idx) => {
        const oldOrder = state[gameId]?.[id]?.order;
        if (oldOrder !== undefined && oldOrder !== idx) {
          newState = {
            ...newState,
            [gameId]: { ...newState[gameId], [id]: { ...newState[gameId][id], order: idx } },
          };
        }
      });
      return newState;
    },
  },
  {
    _: {
      // shouldn't be reported atm
      description: () => "Invalid set of categories",
      elements: {
        _: {
          // shouldn't be reported atm
          description: () => "Invalid category",
          elements: {
            name: {
              description: () => "Category without name will be set to default",
              type: "string",
            },
            order: {
              description: () => "Category without sorting order will be reset",
              type: "number",
            },
          },
        },
      },
    },
  },
);
