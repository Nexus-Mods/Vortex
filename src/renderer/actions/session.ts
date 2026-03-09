import { createAction } from "redux-act";

import type { IParameters } from "@vortex/shared/cli";

const uiOnlyMeta = () => ({ forward: false, scope: "local" });

/**
 * action to choose which item in a group to display (all other items in the
 * group will be hidden). the itemId can be undefined to hide them all.
 */
export const displayGroup = createAction(
  "DISPLAY_GROUP",
  (groupId: string, itemId: string) => ({ groupId, itemId }),
);

export const setDialogVisible = createAction(
  "SET_DIALOG_VISIBLE",
  (dialogId: string) => ({ dialogId }),
);

export const setSettingsPage = createAction(
  "SET_SETTINGS_PAGE",
  (pageId: string) => ({ pageId }),
);

export const setOpenMainPage = createAction(
  "SET_OPEN_MAINPAGE",
  (page: string, secondary: boolean) => ({ page, secondary }),
);

export const startActivity = createAction(
  "START_ACTIVITY",
  (group: string, activityId: string) => ({ group, activityId }),
  uiOnlyMeta,
);

export const stopActivity = createAction(
  "STOP_ACTIVITY",
  (group: string, activityId: string) => ({ group, activityId }),
  uiOnlyMeta,
);

export const setProgress = createAction(
  "SET_PROGRESS",
  (group: string, progressId: string, text: string, percent: number) => ({
    group,
    progressId,
    text,
    percent,
  }),
);

export const setToolRunning = createAction(
  "SET_TOOL_RUNNING",
  (exePath: string, started: number, exclusive: boolean) => ({
    exePath,
    started,
    exclusive,
  }),
);

export const setToolPid = createAction(
  "SET_TOOL_PID",
  (exePath: string, pid: number, exclusive: boolean) => ({
    exePath,
    pid,
    exclusive,
  }),
);

export const setToolStopped = createAction(
  "SET_TOOL_STOPPED",
  (exePath: string) => ({ exePath }),
);

export const setExtensionLoadFailures = createAction(
  "SET_EXT_LOAD_FAILURES",
  (failures) => failures,
);

export const setUIBlocker = createAction(
  "SET_UI_BLOCKER",
  (id: string, icon: string, description: string, mayCancel: boolean) => ({
    id,
    icon,
    description,
    mayCancel,
  }),
);

export const clearUIBlocker = createAction(
  "CLEAR_UI_BLOCKER",
  (id: string) => id,
);

export const setNetworkConnected = createAction(
  "SET_NETWORK_CONNECTED",
  (connected: boolean) => connected,
);

export const setCommandLine = createAction(
  "SET_COMMAND_LINE",
  (args: IParameters) => args,
);
