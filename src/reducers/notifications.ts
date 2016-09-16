import { addNotification, dismissNotification } from '../actions/actions';
import { createReducer } from 'redux-act';
import update = require('react-addons-update');

let counter = 1;

/**
 * reducer for changes to notifications
 */
export const notificationsReducer = createReducer({
  [addNotification]: (state, payload) => {
    if (payload.id === undefined) {
      payload.id = `__auto_${counter++}`;
    }
    update(state, { notifications: { [payload.id]: { $set: payload } } });
  },
  [dismissNotification]: (state, payload) => {
    let idx = state.notifications.findIndex((ele) => ele.id === payload);
    let newList = state.notifications.slice(idx, 1);
    return update(state, { notifications: { $set : newList } });
  }
}, {
  notifications: [
    {id: '__init', type: 'info', actions: [], message: 'just a test'},
  ],
});
