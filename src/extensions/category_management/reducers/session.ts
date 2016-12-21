import { setSearchFocusIndex, setSearchFoundCount,
   setSearchString, setTreeDataObject } from '../actions/session';

import { IReducerSpec } from '../../../types/IExtensionContext';

import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [setSearchFocusIndex]: (state, payload) => {
      return update(state, { searchFocusIndex: { $set: payload } });
    },
    [setSearchFoundCount]: (state, payload) => {
      return update(state, { searchFoundCount: { $set: payload } });
    },
    [setSearchString]: (state, payload) => {
      return update(state, { searchString: { $set: payload } });
    },
    [setTreeDataObject]: (state, payload) => {
      return update(state, { treeDataObject: { $set: payload } });
    },
  },
  defaults: {
    searchFocusIndex: 0,
    searchFoundCount: 0,
    searchString: '',
    treeDataObject: undefined,
  },
};
