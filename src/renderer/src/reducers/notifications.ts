import { generate as shortid } from "shortid";

import {
  addDialog,
  dismissDialog,
  startNotification,
  stopAllNotifications,
  stopNotification,
  updateNotification,
} from "../actions/notifications";
import type { INotificationState } from "../types/IState";
import { actionsToReducerSpec } from "./builder";

const actions = {
  startNotification,
  updateNotification,
  stopNotification,
  stopAllNotifications,
  addDialog,
  dismissDialog,
};

const defaultState: INotificationState = {
  notifications: [],
  global_notifications: [],
  dialogs: [],
};

export const notificationsReducer = actionsToReducerSpec(defaultState, actions, {
  startNotification: (state, payload) => {
    if (payload == null || typeof payload !== "object") {
      return state;
    }
    const listKey = payload.type === "global" ? "global_notifications" : "notifications";
    const list = state[listKey];

    if (payload.id === undefined) {
      payload.id = shortid();
      return { ...state, [listKey]: [...list, payload] };
    }

    const existing = list.find((iter) => iter.id === payload.id);
    if (existing === undefined) {
      return { ...state, [listKey]: [...list, payload] };
    }

    // don't update creation time if we're updating an existing notification
    payload.createdTime = existing.createdTime;
    return {
      ...state,
      [listKey]: [...list.filter((iter) => iter.id !== payload.id), payload],
    };
  },
  updateNotification: (state, payload) => {
    if (payload?.id == null) {
      return state;
    }
    const idx = state.notifications.findIndex((noti) => noti.id === payload.id);
    if (idx === -1) {
      return state;
    }

    return {
      ...state,
      notifications: state.notifications.map((noti, i) =>
        i === idx ? { ...noti, progress: payload.progress, message: payload.message } : noti,
      ),
    };
  },
  stopNotification: (state, payload) => ({
    ...state,
    notifications: state.notifications.filter((noti) => noti.id !== payload),
    global_notifications: state.global_notifications.filter((noti) => noti.id !== payload),
  }),
  stopAllNotifications: (state) => ({ ...state, notifications: [], global_notifications: [] }),
  addDialog: (state, payload) => ({ ...state, dialogs: [payload, ...state.dialogs] }),
  dismissDialog: (state, payload) => ({
    ...state,
    dialogs: state.dialogs.filter((dialog) => dialog.id !== payload),
  }),
});
