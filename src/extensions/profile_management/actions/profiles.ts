import { createAction } from 'redux-act';

/**
 * add or edit a profile
 */
export const setProfile: any = createAction('SET_PROFILE');

/**
 * change current profile
 */
export const setCurrentProfile: any = createAction('SET_CURRENT_PROFILE');

/**
 * enable or disable a mod in the current profile
 */
export const setModEnabled: any = createAction('SET_MOD_ENABLED',
  (modId: string, enable: boolean) => { return { modId, enable }; });
