import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * change the user interface language
 */
export const setLanguage = safeCreateAction('SET_USER_LANGUAGE');

export const setProfilesVisible = safeCreateAction('SET_PROFILES_VISIBLE',
  (visible: boolean) => ({ visible }));
