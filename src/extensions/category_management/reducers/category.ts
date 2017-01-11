import { addCategory, loadCategories, removeCategory,
   renameCategory, updateCategories } from '../actions/category';

import { IReducerSpec } from '../../../types/IExtensionContext';
import {  deleteOrNop, merge, setOrNop, setSafe } from '../../../util/storeHelper';

/**
 * reducer for changes to ephemeral session state
 */
export const categoryReducer: IReducerSpec = {
  reducers: {
    [loadCategories]: (state, payload) => {
    return setOrNop(state, [payload.gameId], payload);
    },
    [updateCategories]: (state, payload) => {
    return setSafe(state, [payload.gameId], payload);
    },
    [addCategory]: (state, payload) => {
    return merge(state, [payload.gameId, 'gameCategories'], payload.gameCategory);
    },
    [removeCategory]: (state, payload) => {
    return deleteOrNop(state, [payload.gameId, 'gameCategories', payload.category] );
    },
    [renameCategory]: (state, payload) => {
    return setSafe(state, [payload.gameId, 'gameCategories',
     payload.oldCategory ], payload.newCategory);
    },
  }, defaults: {

  },
};
