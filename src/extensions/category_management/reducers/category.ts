import { IReducerSpec } from '../../../types/IExtensionContext';

import { setSafe } from '../../../util/storeHelper';
import { loadCategories, updateCategories } from '../actions/category';

import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const categoryReducer: IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']: (state, payload) => {
      if (state.categories === undefined) {
        return update(state, { categories: { $set: payload || {} } });
      } else {
        return state;
      }
    },
    [loadCategories]: (state, payload) => {
        if (state.categories[payload.gameId] === undefined) {
          return setSafe(state, [payload.gameId], payload);
        } else {
          return state;
        }
    },
    [updateCategories]: (state, payload) => {
        return setSafe(state, [payload.gameId], payload);
    },
  }, defaults: {
    categories: {},
  },
};
