import { loadCategories, updateCategories } from '../actions/category';

import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

/**
 * reducer for changes to ephemeral session state
 */
export const categoryReducer: IReducerSpec = {
  reducers: {
    [loadCategories]: (state, payload) => {
      if (state[payload.gameId] === undefined) {
        return setSafe(state, [payload.gameId], payload);
      } else {
        return state;
      }
    },
    [updateCategories]: (state, payload) => {
      return setSafe(state, [payload.gameId], payload);
    },
  }, defaults: {

  },
};
