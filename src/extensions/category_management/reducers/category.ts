import { loadCategories, updateCategories } from '../actions/category';

import { IReducerSpec } from '../../../types/IExtensionContext';
import { setOrNop, setSafe } from '../../../util/storeHelper';

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
  }, defaults: {

  },
};
