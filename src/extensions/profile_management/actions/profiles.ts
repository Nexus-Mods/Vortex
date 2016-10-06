import { createAction } from 'redux-act';

/**
 * add or edit a profile
 */
export const setProfile = createAction('SET_PROFILE');

/**
 * change current profile
 */
export const setCurrentProfile = createAction('SET_CURRENT_PROFILE');

/**
 * enable or disable a mod in the current profile
 */
export const setModEnabled = createAction('SET_MOD_ENABLED',
  (modId: string, enable: boolean) => { return { modId, enable }; });
