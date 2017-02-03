import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * add or edit a profile
 */
export const setProfile: any = safeCreateAction('SET_PROFILE');

/**
 * enable or disable a mod in a profile
 */
// TODO when we enable/disable a mod we need to also install/uninstall links created
//   with this mod
export const setModEnabled: any = safeCreateAction(
  'SET_MOD_ENABLED',
  (profileId: string, modId: string, enable: boolean) => ({profileId, modId, enable}));
