import { IReducerSpec } from '../../../types/IExtensionContext';
import {setSafe} from '../../../util/storeHelper';

import * as actions from '../actions/session';


import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.setSearchFocusIndex as any]: (state, payload) => {
      return update(state, { searchFocusIndex: { $set: payload } });
    },
    [actions.setSearchFoundCount as any]: (state, payload) => {
      return update(state, { searchFoundCount: { $set: payload } });
    },
    [actions.setSearchString as any]: (state, payload) => {
      return update(state, { searchString: { $set: payload } });
    },
    [actions.showHiddenCategories as any]: (state, payload) => {
      return update(state, { isHidden: { $set: payload } });
    },
    [actions.setTreeDataObject as any]: (state, payload) => {
      return update(state, { treeDataObject: { $set: payload } });
    },
    [actions.showCategoriesDialog as any]: (state, payload) =>
      setSafe(state, [ 'showDialog' ], payload),
  },
  defaults: {
    searchFocusIndex: 0,
    searchFoundCount: 0,
    searchString: '',
    treeDataObject: undefined,
    isHidden: false,
    showDialog: false,
  },
};
