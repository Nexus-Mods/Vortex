import { IParameters } from '../util/commandLine';

import safeCreateAction from './safeCreateAction';

import * as reduxAct from 'redux-act';

/**
 * action to choose which item in a group to display (all other items in the
 * group will be hidden). the itemId can be undefined to hide them all.
 */
export const displayGroup = safeCreateAction('DISPLAY_GROUP',
  (groupId: string, itemId: string) => ({ groupId, itemId }));

export const setDialogVisible = safeCreateAction('SET_DIALOG_VISIBLE',
  (dialogId: string) => ({ dialogId }));

export const setSettingsPage = safeCreateAction('SET_SETTINGS_PAGE',
  (pageId: string) => ({ pageId }));

export const setOpenMainPage = safeCreateAction('SET_OPEN_MAINPAGE',
  (page: string, secondary: boolean) => ({ page, secondary }));

export const startActivity = safeCreateAction('START_ACTIVITY',
  (group: string, activityId: string) => ({ group, activityId }));

export const stopActivity = safeCreateAction('STOP_ACTIVITY',
  (group: string, activityId: string) => ({ group, activityId }));

export const setProgress = safeCreateAction('SET_PROGRESS',
  (group: string, progressId: string, text: string, percent: number) =>
    ({ group, progressId, text, percent }));

export const setToolRunning = safeCreateAction('SET_TOOL_RUNNING',
  (exePath: string, started: number, exclusive: boolean) => ({ exePath, started, exclusive }));

export const setToolPid = safeCreateAction('SET_TOOL_RUNNING',
  (exePath: string, pid: number, exclusive: boolean) => ({ exePath, pid, exclusive }));

export const setToolStopped = safeCreateAction('SET_TOOL_STOPPED',
  (exePath: string) => ({ exePath }));

export const setExtensionLoadFailures =
  safeCreateAction('SET_EXT_LOAD_FAILURES', failures => failures);

export const setUIBlocker =
  safeCreateAction('SET_UI_BLOCKER',
  (id: string, icon: string, description: string, mayCancel: boolean) =>
  ({ id, icon, description, mayCancel }));

export const clearUIBlocker = safeCreateAction('CLEAR_UI_BLOCKER', (id: string) => id);

export const setNetworkConnected =
  safeCreateAction('SET_NETWORK_CONNECTED', (connected: boolean) => connected);

export const setCommandLine = safeCreateAction('SET_COMMAND_LINE', (args: IParameters) => args);
