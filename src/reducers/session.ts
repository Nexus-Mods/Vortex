import * as actions from '../actions/session';
import { IReducerSpec } from '../types/IExtensionContext';

import { pushSafe, removeValue, setSafe } from '../util/storeHelper';

/**
 * reducer for changes to the window state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.displayGroup as any]: (state, payload) =>
      setSafe(state, [ 'displayGroups', payload.groupId ], payload.itemId),
    [actions.setDialogVisible as any]: (state, payload) =>
      setSafe(state, [ 'visibleDialog' ], payload.dialogId),
    [actions.setOverlayOpen as any]: (state, payload) =>
      setSafe(state, [ 'overlayOpen' ], payload.open),
    [actions.setSettingsPage as any]: (state, payload) =>
      setSafe(state, [ 'settingsPage' ], payload.pageId),
    [actions.startActivity as any]: (state, payload) =>
      pushSafe(state, [ 'activity', payload.group ], payload.activityId),
    [actions.stopActivity as any]: (state, payload) =>
      removeValue(state, [ 'activity', payload.group ], payload.activityId),
  },
  defaults: {
    displayGroups: {},
    visibleDialog: undefined,
    overlayOpen: false,
    activity: {},
    settingsPage: undefined,
  },
};
