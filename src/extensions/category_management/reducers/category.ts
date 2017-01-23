import { IReducerSpec } from '../../../types/IExtensionContext';
import { setOrNop, setSafe } from '../../../util/storeHelper';

import { loadCategories, renameCategory, updateCategories } from '../actions/category';

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
    [renameCategory]: (state, payload) => {
    return setSafe(state, [payload.gameId, payload.oldCategory ], payload.newCategory);
    },
  }, defaults: {

  },
};
