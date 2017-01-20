import { createAction } from 'redux-act';

export const setSearchString: any = createAction('SET_SEARCH_STRING');

export const setSearchFocusIndex: any = createAction('SET_SEARCH_FOCUS_INDEX');

export const setSearchFoundCount: any = createAction('SET_SEARCH_FOUND_COUNT');

export const setTreeDataObject: any = createAction('SET_TREE_DATA_OBJECT');

export const setHidedCategories: any = createAction('SET_HIDED_CATEGORIES');
