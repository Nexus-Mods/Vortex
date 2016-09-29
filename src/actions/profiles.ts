import { createAction } from 'redux-act';

/**
 * add or edit a profile
 */
export const setProfile = createAction('SET_PROFILE');

/**
 * change current profile
 */
export const setCurrentProfile = createAction('SET_CURRENT_PROFILE');
