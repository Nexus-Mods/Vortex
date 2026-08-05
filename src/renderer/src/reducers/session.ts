import * as path from "path";

import * as actions from "../actions/session";
import type { ISession } from "../types/IState";
import { actionsToReducerSpec } from "./builder";

export function makeExeId(exePath: string): string {
  // TODO: stripping the path means that we can't distinguish between different installations
  // of the same exe running at the same time, we might see an exe as "not running" when it
  // actually is. This is rather unlikely though.
  // On the flipside, if we _don't_ use the basename, lookup will be more complicated and
  // thus slower.
  return path.basename(exePath).toLowerCase();
}

/** True when the exe with this id (from makeExeId) appears in a session.base.toolsRunning map. */
export function isExeIdRunning(
  toolsRunning: Readonly<Record<string, unknown>>,
  exeId: string,
): boolean {
  return toolsRunning[exeId] !== undefined;
}

/** True when the exe at this path is running (its basename appears in toolsRunning). */
export function isExeRunning(
  toolsRunning: Readonly<Record<string, unknown>>,
  exePath: string,
): boolean {
  if (!exePath) {
    return false;
  }
  return isExeIdRunning(toolsRunning, makeExeId(exePath));
}

/** True when any running tool holds the exclusive lock (which blocks other launches). */
export function hasExclusiveToolRunning(
  toolsRunning: Readonly<Record<string, ISession["toolsRunning"][string]>>,
): boolean {
  return Object.values(toolsRunning).some((tool) => tool.exclusive);
}

export const defaultState: ISession = {
  displayGroups: {},
  overlayOpen: false,
  visibleDialog: undefined,
  networkConnected: true,
  mainPage: "",
  secondaryPage: "",
  activity: {},
  progress: {},
  settingsPage: undefined,
  extLoadFailures: {},
  toolsRunning: {},
  uiBlockers: {},
  commandLine: {},
  downloadGameFilter: null,
};

export const sessionReducer = actionsToReducerSpec(defaultState, actions, {
  displayGroup: (state, payload) => ({
    ...state,
    displayGroups: { ...state.displayGroups, [payload.groupId]: payload.itemId },
  }),
  setDialogVisible: (state, payload) => ({ ...state, visibleDialog: payload.dialogId }),
  setSettingsPage: (state, payload) => ({ ...state, settingsPage: payload.pageId }),
  startActivity: (state, payload) => {
    const group = state.activity[payload.group] ?? new Array<string>();
    if (group.includes(payload.activityId)) {
      return state;
    }
    return {
      ...state,
      activity: { ...state.activity, [payload.group]: [...group, payload.activityId] },
    };
  },
  stopActivity: (state, payload) => {
    const group: string[] = state.activity[payload.group] ?? new Array<string>();
    return {
      ...state,
      activity: {
        ...state.activity,
        [payload.group]: group.filter((id) => id !== payload.activityId),
      },
    };
  },
  setProgress: (state, payload) => ({
    ...state,
    progress: {
      ...state.progress,
      [payload.group]: {
        ...state.progress[payload.group],
        [payload.progressId]: {
          text: payload.text,
          percent: Math.round(payload.percent),
        },
      },
    },
  }),
  setOpenMainPage: (state, payload) =>
    payload.secondary
      ? { ...state, secondaryPage: payload.page }
      : { ...state, mainPage: payload.page, secondaryPage: "" },
  setExtensionLoadFailures: (state, payload) => ({ ...state, extLoadFailures: payload }),
  setToolRunning: (state, payload) => ({
    ...state,
    toolsRunning: {
      ...state.toolsRunning,
      [makeExeId(payload.exePath)]: {
        exePath: payload.exePath,
        started: payload.started,
        pid: undefined,
        exclusive: payload.exclusive || false,
      },
    },
  }),
  setToolPid: (state, payload) => {
    const exeId = makeExeId(payload.exePath);
    return {
      ...state,
      toolsRunning: {
        ...state.toolsRunning,
        [exeId]: {
          ...state.toolsRunning[exeId],
          pid: payload.pid,
          exclusive: payload.exclusive || false,
        },
      },
    };
  },
  setToolStopped: (state, payload) => {
    const { [makeExeId(payload.exePath)]: _, ...toolsRunning } = state.toolsRunning;
    return { ...state, toolsRunning };
  },
  setUIBlocker: (state, payload) => ({
    ...state,
    uiBlockers: {
      ...state.uiBlockers,
      [payload.id]: {
        icon: payload.icon,
        description: payload.description,
        mayCancel: payload.mayCancel,
      },
    },
  }),
  clearUIBlocker: (state, payload) => {
    const { [payload]: _, ...uiBlockers } = state.uiBlockers;
    return { ...state, uiBlockers };
  },
  setNetworkConnected: (state, payload) => ({ ...state, networkConnected: payload }),
  setCommandLine: (state, payload) => ({ ...state, commandLine: payload }),
  setDownloadGameFilter: (state, payload) => ({ ...state, downloadGameFilter: payload }),
});
