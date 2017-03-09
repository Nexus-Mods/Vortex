import { IReducerSpec } from '../../../types/IExtensionContext';
import { setOrNop, setSafe } from '../../../util/storeHelper';

import { loadCategories, renameCategory, updateCategories } from '../actions/category';

/**
 * reducer for changes to ephemeral session state
 */
export const categoryReducer: IReducerSpec = {
  reducers: {
    [loadCategories as any]: (state, payload) => {
      return setOrNop(state, [payload.gameId], payload.gameCategories);
    },
    [updateCategories as any]: (state, payload) => {
      return setSafe(state, [payload.gameId], payload.gameCategories);
    },
    [renameCategory as any]: (state, payload) => {
      return setOrNop(state, [payload.gameId, payload.categoryId, 'name'], payload.name);
    },
  }, defaults: {

  },
};
