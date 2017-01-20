import { IReducerSpec } from '../../../types/IExtensionContext';
import {  deleteOrNop, merge, setOrNop, setSafe } from '../../../util/storeHelper';

import { addCategory, loadCategories, removeCategory,
   renameCategory, setTreeDataOrder, updateCategories } from '../actions/category';

/**
 * reducer for changes to ephemeral session state
 */
export const categoryReducer: IReducerSpec = {
  reducers: {
    [loadCategories]: (state, payload) => {
    return setOrNop(state, [payload.gameId], payload.gameCategories);
    },
    [updateCategories]: (state, payload) => {
    return setSafe(state, [payload.gameId], payload.gameCategories);
    },
    [addCategory]: (state, payload) => {
    return merge(state, [payload.gameId], payload.gameCategory);
    },
    [removeCategory]: (state, payload) => {
    return deleteOrNop(state, [payload.gameId, payload.category] );
    },
    [renameCategory]: (state, payload) => {
    return setSafe(state, [payload.gameId, payload.oldCategory ], payload.newCategory);
    },
    [setTreeDataOrder]: (state, payload) => {
      const { gameId, treeDataOrder } = payload;
      return setSafe(state, ['treeDataOrder', gameId], treeDataOrder);
    },
  }, defaults: {

  },
};
