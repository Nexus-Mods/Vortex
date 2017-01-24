import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * add or edit a profile
 */
export const setProfile: any = safeCreateAction('SET_PROFILE');

/**
 * change current profile
 */
export const setCurrentProfile: any = safeCreateAction('SET_CURRENT_PROFILE');

/**
 * enable or disable a mod in the current profile
 */
// TODO when we enable/disable a mod we need to also install/uninstall links created
//   with this mod
export const setModEnabled: any = safeCreateAction('SET_MOD_ENABLED',
  (modId: string, enable: boolean) => { return { modId, enable }; });
