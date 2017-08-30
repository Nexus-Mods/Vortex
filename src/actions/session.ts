import safeCreateAction from './safeCreateAction';

/**
 * action to choose which item in a group to display (all other items in the
 * group will be hidden). the itemId can be undefined to hide them all.
 */
export const displayGroup = safeCreateAction('DISPLAY_GROUP',
  (groupId: string, itemId?: string) => ({ groupId, itemId }));

export const setDialogVisible = safeCreateAction('SET_DIALOG_VISIBLE',
  (dialogId: string) => ({ dialogId }));

export const setSettingsPage = safeCreateAction('SET_SETTINGS_PAGE',
  (pageId: string) => ({ pageId }));

/**
 * open the overlay for the current page
 */
export const setOverlayOpen = safeCreateAction('SET_OVERLAY_OPEN',
  (open: boolean) => ({ open }));

export const setOpenMainPage = safeCreateAction('SET_OPEN_MAINPAGE',
  (page: string, secondary?: boolean) => ({ page, secondary: secondary || false }));

export const startActivity = safeCreateAction('START_ACTIVITY',
  (group: string, activityId: string) => ({ group, activityId }));

export const stopActivity = safeCreateAction('STOP_ACTIVITY',
  (group: string, activityId: string) => ({ group, activityId }));

export const setExtensionLoadFailures = safeCreateAction('SET_EXT_LOAD_FAILURES');
