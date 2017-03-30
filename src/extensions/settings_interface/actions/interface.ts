import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * change the user interface language
 */
export const setLanguage = safeCreateAction('SET_USER_LANGUAGE');

/**
 * enable or disable advanced mode
 */
export const setAdvancedMode = safeCreateAction('SET_ADVANCED_MODE',
  (advanced: boolean) => ({ advanced }));

export const setProfilesVisible = safeCreateAction('SET_PROFILES_VISIBLE',
  (visible: boolean) => ({ visible }));
