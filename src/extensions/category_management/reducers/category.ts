import { IReducerSpec } from '../../../types/IExtensionContext';

import { loadCategories, updateCategories } from '../actions/category';

import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const categoryReducer: IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']: (state, payload) => {
      if (state.categories === undefined) {
        return update(state, { categories: { $set: payload.categories || {} } });
      } else {
        return state;
      }
    },
    [loadCategories]: (state, payload) => {
      if (state.categories.categories === undefined) {
        return update(state, { categories: { $set: payload } });
      } else {
        return state;
      }
    },
    [updateCategories]: (state, payload) => {
      return update(state, { categories: { $set: payload } });
    },
  }, defaults: {
    categories: {},
  },
};
