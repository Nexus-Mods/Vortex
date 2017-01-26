import safeCreateAction from '../../../actions/safeCreateAction';

export const setSearchString: any = safeCreateAction('SET_SEARCH_STRING');

export const setSearchFocusIndex: any = safeCreateAction('SET_SEARCH_FOCUS_INDEX');

export const setSearchFoundCount: any = safeCreateAction('SET_SEARCH_FOUND_COUNT');

export const setTreeDataObject: any = safeCreateAction('SET_TREE_DATA_OBJECT');

export const setHiddenCategories: any = safeCreateAction('SET_HIDDEN_CATEGORIES');
