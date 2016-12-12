import { IReducerSpec } from '../../../types/IExtensionContext';

import { addCategory, setStateCategory } from '../actions/session';

import { setSafe } from '../../../util/storeHelper';

import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']: (state, payload) => {
      if (payload.categories !== undefined) {
        return update(state, { categories: { $set: payload.categories || {} } });
      } else {
        return state;
      }
    },
    [addCategory]: (state, payload) => {
      return setSafe(state, ['categories', payload.category_id], payload);
    },
    [setStateCategory]: (state, payload) => {
      return setSafe(state, ['categories'], payload);
    },
  }, defaults: {
    categories: {},
  },
};
