import { IReducerSpec } from '../../../types/IExtensionContext';

import { addCategory, loadCategories, removeCategory } from '../actions/category';

import { deleteOrNop, pushSafe, removeValue } from '../../../util/storeHelper';

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
    [addCategory]: (state, payload) => {
      return pushSafe(state, ['children'], payload);
    },
    [removeCategory]: (state, payload) => {
      return deleteOrNop(state, ['categories', 'categories',
       payload.rootId, 'children', payload]);
    },
  }, defaults: {
    categories: {},
  },
};
