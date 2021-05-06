import * as actions from '../actions/session';
import { IReducerSpec } from '../types/IExtensionContext';

import { addUniqueSafe, deleteOrNop, pushSafe, removeValue, setSafe } from '../util/storeHelper';

import * as path from 'path';

export function makeExeId(exePath: string): string {
  // TODO: stripping the path means that we can't distinguish between different installations
  // of the same exe running at the same time, we might see an exe as "not running" when it
  // actually is. This is rather unlikely though.
  // On the flipside, if we _don't_ use the basename, lookup will be more complicated and
  // thus slower.
  return path.basename(exePath).toLowerCase();
}

/**
 * reducer for changes to the window state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.displayGroup as any]: (state, payload) =>
      setSafe(state, [ 'displayGroups', payload.groupId ], payload.itemId),
    [actions.setDialogVisible as any]: (state, payload) =>
      setSafe(state, [ 'visibleDialog' ], payload.dialogId),
    [actions.setSettingsPage as any]: (state, payload) =>
      setSafe(state, [ 'settingsPage' ], payload.pageId),
    [actions.startActivity as any]: (state, payload) =>
      addUniqueSafe(state, [ 'activity', payload.group ], payload.activityId),
    [actions.stopActivity as any]: (state, payload) =>
      removeValue(state, [ 'activity', payload.group ], payload.activityId),
    [actions.setProgress as any]: (state, payload) =>
      setSafe(state, ['progress', payload.group, payload.progressId],
              { text: payload.text, percent: Math.round(payload.percent) }),
    [actions.setOpenMainPage as any]: (state, payload) => {
      if (payload.secondary) {
        return setSafe(state, [ 'secondaryPage' ], payload.page);
      } else {
        return setSafe(
          setSafe(state, [ 'mainPage' ], payload.page),
          [ 'secondaryPage' ], '');
      }
    },
    [actions.setExtensionLoadFailures as any]: (state, payload) =>
      setSafe(state, ['extLoadFailures'], payload),
    [actions.setToolRunning as any]: (state, payload) =>
      setSafe(state, ['toolsRunning', makeExeId(payload.exePath)], {
        exePath: payload.exePath,
        started: payload.started,
        pid: undefined,
        exclusive: payload.exclusive || false,
      }),
    [actions.setToolPid as any]: (state, payload) =>
      setSafe(state, ['toolsRunning', makeExeId(payload.exePath)], {
        exePath: payload.exePath,
        started: payload.started,
        pid: payload.pid,
        exclusive: payload.exclusive || false,
      }),
    [actions.setToolStopped as any]: (state, payload) =>
      deleteOrNop(state, ['toolsRunning', makeExeId(payload.exePath)]),
    [actions.setUIBlocker as any]: (state, payload) =>
      setSafe(state, ['uiBlockers', payload.id], {
        icon: payload.icon,
        description: payload.description,
        mayCancel: payload.mayCancel,
      }),
    [actions.clearUIBlocker as any]: (state, payload) =>
      deleteOrNop(state, ['uiBlockers', payload]),
    [actions.setNetworkConnected as any]: (state, payload) =>
      setSafe(state, ['networkConnected'], payload),
    [actions.setCommandLine as any]: (state, payload) =>
      setSafe(state, ['commandLine'], payload),
  },
  defaults: {
    displayGroups: {},
    visibleDialog: undefined,
    overlayOpen: false,
    networkConnected: true,
    mainPage: '',
    secondaryPage: '',
    activity: {},
    progress: {},
    settingsPage: undefined,
    extLoadFailures: {},
    toolsRunning: {},
    uiBlockers: {},
    commandLine: {},
  },
};
