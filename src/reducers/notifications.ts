import { dismissNotification, startNotification } from '../actions/notifications';
import { dismissDialog, showDialog } from '../actions/notifications';
import { IReducerSpec } from '../types/IExtensionContext';

import update = require('react-addons-update');

let counter = 1;

/**
 * reducer for changes to notifications
 */
export const notificationsReducer: IReducerSpec = {
  reducers: {
    [startNotification]: (state, payload) => {
      if (payload.id === undefined) {
        payload.id = `__auto_${counter++}`;
      }
      return update(state, { notifications: { $push: [payload] } });
    },
    [dismissNotification]: (state, payload) => {
      const idx = state.notifications.findIndex((ele) => ele.id === payload);
      if (idx < 0) {
        return state;
      } else {
        return update(state, { notifications: { $splice: [[idx, 1]] } });
      }
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
    dialogs: [],
  },
};
