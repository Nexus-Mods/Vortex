import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

/**
 * change the user interface language
 */
export const setLanguage = safeCreateAction('SET_USER_LANGUAGE', lang => lang);

/**
 * enable or disable advanced mode
 */
export const setAdvancedMode = safeCreateAction('SET_ADVANCED_MODE',
  (advanced: boolean) => ({ advanced }));

export const setProfilesVisible = safeCreateAction('SET_PROFILES_VISIBLE',
  (visible: boolean) => ({ visible }));
