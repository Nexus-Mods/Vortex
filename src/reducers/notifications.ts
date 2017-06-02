import * as actions from '../actions/notifications';
import { IReducerSpec } from '../types/IExtensionContext';

import {pushSafe, removeValueIf} from '../util/storeHelper';

import * as update from 'immutability-helper';

/**
 * reducer for changes to notifications
 */
export const notificationsReducer: IReducerSpec = {
  reducers: {
    [actions.startNotification as any]: (state, payload) => {
      const statePath = payload.type === 'global' ? ['global_notifications'] :
                                                    ['notifications'];
      const temp = removeValueIf(state, statePath, (noti) => noti.id === payload.id);
      return pushSafe(temp, statePath, payload);
    },
    [actions.dismissNotification as any]: (state, payload) => {
      return removeValueIf(removeValueIf(state, [ 'notifications' ], (noti) => noti.id === payload),
                           [ 'global_notifications' ], (noti) => noti.id === payload);
    },
    [actions.addDialog as any]: (state, payload) => {
      return update(state, { dialogs: { $push: [payload] } });
    },
    [actions.dismissDialog as any]: (state, payload) => {
      return removeValueIf(state, [ 'dialogs' ], (dialog) => dialog.id === payload);
    },
  },
  defaults: {
    notifications: [],
    global_notifications: [],
    dialogs: [],
  },
};
