import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * add or edit a profile
 */
export const setProfile = safeCreateAction('SET_PROFILE');

export const removeProfile = safeCreateAction('REMOVE_PROFILE');

/**
 * enable or disable a mod in a profile
 */
export const setModEnabled = safeCreateAction(
  'SET_MOD_ENABLED',
  (profileId: string, modId: string, enable: boolean) => ({profileId, modId, enable}));

export const forgetMod = safeCreateAction(
  'FORGET_PROFILE_MOD',
  (profileId: string, modId: string) => ({ profileId, modId }));

export const setFeature = safeCreateAction(
  'SET_PROFILE_FEATURE',
  (profileId: string, featureId: string, value: any) => ({profileId, featureId, value}));

export const setProfileActivated = safeCreateAction('SET_PROFILE_ACTIVATED');
