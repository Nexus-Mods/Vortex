import safeCreateAction from '../../../actions/safeCreateAction';

export const setSearchString = safeCreateAction('SET_SEARCH_STRING');

export const setSearchFocusIndex = safeCreateAction('SET_SEARCH_FOCUS_INDEX');

export const setSearchFoundCount = safeCreateAction('SET_SEARCH_FOUND_COUNT');

export const setTreeDataObject = safeCreateAction('SET_TREE_DATA_OBJECT');

export const setHiddenCategories = safeCreateAction('SET_HIDDEN_CATEGORIES');
