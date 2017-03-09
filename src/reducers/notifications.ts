import * as actions from '../actions/notifications';
import { IReducerSpec } from '../types/IExtensionContext';

import update = require('react-addons-update');

import { removeValueIf } from '../util/storeHelper';

let counter = 1;

/**
 * reducer for changes to notifications
 */
export const notificationsReducer: IReducerSpec = {
  reducers: {
    [actions.startNotification as any]: (state, payload) => {
      let temp = state;
      if (payload.id === undefined) {
        payload.id = `__auto_${counter++}`;
      } else {
        if (payload.type === 'global') {
          temp = removeValueIf(state, ['global_notifications'], (noti) => noti.id === payload.id);
        } else {
          temp = removeValueIf(state, ['notifications'], (noti) => noti.id === payload.id);
        }
      }
      if (payload.type === 'global') {
        return update(temp, { global_notifications: { $push: [payload] } });
      } else {
        return update(temp, { notifications: { $push: [payload] } });
      }
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
