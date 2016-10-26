import { dismissNotification, startNotification } from '../actions/notifications';
import { dismissDialog, showDialog } from '../actions/notifications';
import { IReducerSpec } from '../types/IExtensionContext';

import update = require('react-addons-update');

import { removeValueIf } from '../util/storeHelper';

let counter = 1;

/**
 * reducer for changes to notifications
 */
export const notificationsReducer: IReducerSpec = {
  reducers: {
    [startNotification]: (state, payload) => {
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
    [dismissNotification]: (state, payload) => {
      return removeValueIf(removeValueIf(state, [ 'notifications' ], (noti) => noti.id === payload),
                           [ 'global_notifications' ], (noti) => noti.id === payload);
    },
    [showDialog]: (state, payload) => {
      return update(state, { dialogs: { $push: [payload] } });
    },
    [dismissDialog]: (state, payload) => {
      return update(state, { dialogs: { $splice: [[0, 1]] } });
    },
  },
  defaults: {
    notifications: [],
    global_notifications: [],
    dialogs: [],
  },
};
