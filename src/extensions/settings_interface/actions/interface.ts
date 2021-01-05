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

export const setDesktopNotifications = safeCreateAction('SET_DESKTOP_NOTIFICATIONS',
  (enabled: boolean) => enabled);

export const setHideTopLevelCategory = safeCreateAction('SET_HIDE_TOPLEVEL_CATEGORY',
  (hide: boolean) => ({ hide }));

export const showUsageInstruction = safeCreateAction('SHOW_USAGE_INSTRUCTION',
  (usageId: string, show: boolean) => ({ usageId, show }));

export const setRelativeTimes = safeCreateAction('SET_RELATIVE_TIMES',
  (enabled: boolean) => enabled);

export const setForegroundDL = safeCreateAction('SET_FOREGROUND_DL',
  (enabled: boolean) => enabled);
