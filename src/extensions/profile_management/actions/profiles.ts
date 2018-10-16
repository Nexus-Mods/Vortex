import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

/**
 * add or edit a profile
 */
export const setProfile = safeCreateAction('SET_PROFILE', profileId => profileId);

export const removeProfile = safeCreateAction('REMOVE_PROFILE', profileId => profileId);

export const willRemoveProfile =safeCreateAction('WILL_REMOVE_PROFILE', profileId => profileId);

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

export const setProfileActivated =
  safeCreateAction('SET_PROFILE_ACTIVATED', (active: string) => active);
