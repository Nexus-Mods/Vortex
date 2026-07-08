import type { ICategory } from "@nexusmods/nexus-api";

import type { IReducerSpec } from "../../../types/IExtensionContext";
import { deleteOrNop, setOrNop, setSafe } from "../../../util/storeHelper";
import * as actions from "../actions/category";
import type { ICategoryState } from "../types/ICategoryDictionary";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * reducer for changes to ephemeral session state
 */
export const categoryReducer: IReducerSpec = {
  reducers: {
    [actions.loadCategories as any]: (
      state: ICategoryState,
      payload: { gameId: string; gameCategories: unknown[] },
    ) => setOrNop(state, [payload.gameId], payload.gameCategories),
    [actions.setCategory as any]: (
      state,
      payload: { gameId: string; id: string; category: ICategory },
    ) => setSafe(state, [payload.gameId, payload.id], payload.category),
    [actions.removeCategory as any]: (
      state: ICategoryState,
      payload: { gameId: string; id: string },
    ) => deleteOrNop(state, [payload.gameId, payload.id]),
    [actions.updateCategories as any]: (
      state: ICategoryState,
      payload: { gameId: string; gameCategories: unknown[] },
    ) => setSafe(state, [payload.gameId], payload.gameCategories),
    [actions.renameCategory as any]: (
      state: ICategoryState,
      payload: { gameId: string; categoryId: string; name: string },
    ) => setOrNop(state, [payload.gameId, payload.categoryId, "name"], payload.name),
    [actions.setCategoryOrder as any]: (
      state: ICategoryState,
      payload: { gameId: string; categoryIds: string[] },
    ) => {
      const { gameId, categoryIds } = payload;
      let newState = state;
      categoryIds.forEach((id, idx) => {
        const oldOrder = state[gameId]?.[id]?.order;
        if (oldOrder !== undefined && oldOrder !== idx) {
          newState = setSafe(newState, [gameId, id, "order"], idx);
        }
      });
      return newState;
    },
  },
  defaults: {},
  verifiers: {
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
};
