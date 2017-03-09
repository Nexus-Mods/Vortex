import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * sets a profile to be activated
 */
export const setNextProfile = safeCreateAction(
  'SET_NEXT_PROFILE', (profileId: string) => ({ profileId }));

/**
 * change current profile
 * this must only be used by profile_management internally!
 */
export const setCurrentProfile = safeCreateAction(
  'SET_CURRENT_PROFILE', (gameId: string, profileId: string) => ({ gameId, profileId }));
