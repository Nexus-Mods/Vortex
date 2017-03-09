import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * add or edit a profile
 */
export const setProfile = safeCreateAction('SET_PROFILE');

/**
 * enable or disable a mod in a profile
 */
// TODO when we enable/disable a mod we need to also install/uninstall links created
//   with this mod
export const setModEnabled = safeCreateAction(
  'SET_MOD_ENABLED',
  (profileId: string, modId: string, enable: boolean) => ({profileId, modId, enable}));

export const setFeature = safeCreateAction(
  'SET_FEATURE',
  (profileId: string, featureId: string, value: any) => ({profileId, featureId, value}));
