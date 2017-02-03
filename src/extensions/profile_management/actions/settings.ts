import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * change current profile
 */
export const setCurrentProfile: any = safeCreateAction(
  'SET_CURRENT_PROFILE', (gameId: string, profileId: string) => ({ gameId, profileId }));
