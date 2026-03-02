import type {
  DialogActions,
  DialogType,
  IDialogContent,
  IDialogResult,
} from "../types/IDialog";
import type {
  INotification,
  NotificationDismiss,
} from "../types/INotification";
import local from "../util/local";
import { log } from "../util/log";
import { getErrorMessageOrDefault } from "@vortex/shared";

import safeCreateAction from "./safeCreateAction";

import PromiseBB from "bluebird";
import { ipcMain, ipcRenderer } from "electron";

import { generate as shortid } from "shortid";

export * from "../types/IDialog";

const identity = (input) => input;

/**
 * adds a notification to be displayed. Takes one parameter of type INotification. The id may be
 * left unset, in that case one will be generated
 */
export const startNotification = safeCreateAction("ADD_NOTIFICATION", identity);

export const updateNotification = safeCreateAction(
  "UPDATE_NOTIFICATION",
  (id: string, progress: number, message: string) => ({
    id,
    progress,
    message,
  }),
  () => ({ forward: false, scope: "local" }),
);

/**
 * dismiss a notification. Takes the id of the notification
 */
export const stopNotification = safeCreateAction("STOP_NOTIFICATION", identity);

export const stopAllNotifications = safeCreateAction("STOP_ALL_NOTIFICATIONS");

/**
 * show a modal dialog to the user
 *
 * don't call this directly, use showDialog
 */
export const addDialog = safeCreateAction(
  "SHOW_MODAL_DIALOG",
  (
    id: string,
    type: string,
    title: string,
    content: IDialogContent,
    defaultAction: string | undefined,
    actions: string[],
  ) => ({ id, type, title, content, defaultAction, actions }),
);

/**
 * dismiss the dialog being displayed
 *
 * don't call this directly especially when you used "showDialog" to create the dialog or
 * you leak (a tiny amount of) memory and the action callbacks aren't called.
 * Use closeDialog instead
 */
export const dismissDialog = safeCreateAction("DISMISS_MODAL_DIALOG", identity);

const timers = local<{ [id: string]: NodeJS.Timeout }>(
  "notification-timers",
  {},
);

type NotificationFunc = (dismiss: NotificationDismiss) => void;
const notificationActions = local<{ [id: string]: NotificationFunc[] }>(
  "notification-actions",
  {},
);

export function fireNotificationAction(
  notiId: string,
  notiProcess: string,
  action: number,
  dismiss: NotificationDismiss,
) {
  if (notiProcess === process.type) {
    if (notificationActions[notiId] === undefined) {
      // this can happen if vortex was restarted and so the notification is still in the store but
      // the callbacks are no longer available.
      return;
    }
    const func = notificationActions[notiId]?.[action];
    if (func !== undefined) {
      func(dismiss);
    }
  } else {
    // assumption is that notification actions are only triggered by the ui
    // TODO: have to send synchronously because we need to know if we should dismiss
    const res: boolean = ipcRenderer.sendSync(
      "fire-notification-action",
      notiId,
      action,
    );
    if (res) {
      dismiss();
    }
  }
}

if (ipcMain !== undefined) {
  ipcMain.on(
    "fire-notification-action",
    (event: any, notiId: string, action: number) => {
      const func = notificationActions[notiId]?.[action];
      let res = false;
      if (func !== undefined) {
        func(() => {
          res = true;
        });
      }

      event.returnValue = res;
    },
  );

  ipcMain.on(
    "fire-dialog-action",
    (event: any, dialogId: string, action: string, input: any) => {
      const func = DialogCallbacks.instance()[dialogId];
      if (func !== undefined) {
        func(action, input);
        delete DialogCallbacks.instance()[dialogId];
      }
      event.returnValue = true;
    },
  );
}

let suppressNotification: (id: string) => boolean = () => false;

export function setupNotificationSuppression(cb: (id: string) => boolean) {
  suppressNotification = cb;
}

/**
 * show a notification
 *
 * @export
 * @param {INotification} notification
 * @returns
 */
export function addNotification(notification: INotification) {
  return (dispatch) => {
    const noti = { ...notification };

    if (noti.id !== undefined && suppressNotification(noti.id)) {
      return PromiseBB.resolve();
    }

    if (noti.id === undefined) {
      noti.id = shortid();
    } else if (timers[noti.id] !== undefined) {
      // if this notification is replacing an active one with a timeout,
      // stop that timeout
      clearTimeout(timers[noti.id]);
      delete timers[noti.id];
      delete notificationActions[noti.id];
    }

    if (noti.createdTime === undefined) {
      noti.createdTime = Math.floor(Date.now() / 1000) * 1000;
    }
    noti.updatedTime = Math.floor(Date.now() / 1000) * 1000;

    notificationActions[noti.id] =
      noti.actions == null ? [] : noti.actions.map((action) => action.action);

    const storeNoti: any = JSON.parse(JSON.stringify(noti));
    storeNoti.process = process.type;
    storeNoti.actions = (storeNoti.actions || []).map((action) => ({
      title: action.title,
      icon: action.icon,
    })) as any;

    dispatch(startNotification(storeNoti));
    if (noti.id !== undefined && noti.displayMS !== undefined) {
      const currentId = noti.id;
      const currentDisplayMS = noti.displayMS;
      return new Promise<void>((resolve) => {
        timers[currentId] = setTimeout(() => resolve(), currentDisplayMS);
      }).then(() => {
        dispatch(dismissNotification(currentId));
      });
    }
  };
}

export function dismissNotification(id: string) {
  return (dispatch) =>
    new PromiseBB<void>((resolve, reject) => {
      delete timers[id];
      delete notificationActions[id];
      dispatch(stopNotification(id));
      resolve();
    });
}

export function dismissAllNotifications() {
  return (dispatch) =>
    new PromiseBB<void>((resolve, reject) => {
      const ids = Array.from(
        new Set<string>([
          ...Object.keys(timers),
          ...Object.keys(notificationActions),
        ]),
      );
      ids.forEach((id) => {
        delete timers[id];
        delete notificationActions[id];
      });
      dispatch(stopAllNotifications());
      resolve();
    });
}

// singleton holding callbacks for active dialogs. The
// actual storage is the "global" object so it gets shared between
// all instances of this module (across extensions).
class DialogCallbacks {
  public static instance(): any {
    if ((global as any).__dialogCallbacks === undefined) {
      (global as any).__dialogCallbacks = {};
    }
    return (global as any).__dialogCallbacks;
  }
}

/**
 * show a dialog
 *
 * @export
 * @param {DialogType} type
 * @param {string} title
 * @param {IDialogContent} content
 * @param {IDialogActions} actions
 * @returns
 */
export function showDialog(
  type: DialogType,
  title: string,
  content: IDialogContent,
  actions: DialogActions,
  inId?: string,
) {
  return (dispatch) => {
    return new PromiseBB<IDialogResult>((resolve, reject) => {
      const id = inId || shortid();
      const defaultAction = actions.find((iter) => iter.default === true);
      const defaultLabel =
        defaultAction !== undefined ? defaultAction.label : undefined;
      dispatch(
        addDialog(
          id,
          type,
          title,
          content,
          defaultLabel,
          actions.map((action) => action.label),
        ),
      );
      DialogCallbacks.instance()[id] = (actionKey: string, input?: any) => {
        const action = actions.find((iter) => iter.label === actionKey);
        if (action?.action) {
          try {
            const res: any = action.action(input);
            if (res !== undefined && res.catch !== undefined) {
              res.catch((err) => {
                log("error", "rejection from dialog callback", {
                  title,
                  action: action.label,
                  message: getErrorMessageOrDefault(err),
                });
              });
            }
          } catch (err) {
            log("error", "exception from dialog callback", {
              title,
              action: action.label,
              message: getErrorMessageOrDefault(err),
            });
          }
        }
        resolve({ action: actionKey, input });
      };
      DialogCallbacks.instance()[`__link-${id}`] = (idx: string) => {
        content.links?.[idx]?.action(() => {
          dispatch(dismissDialog(id));
        }, content.links[idx].id);
      };
    });
  };
}

export function closeDialog(id: string, actionKey?: string, input?: any) {
  return (dispatch) => {
    dispatch(dismissDialog(id));
    try {
      if (actionKey !== undefined) {
        if (DialogCallbacks.instance()[id] !== undefined) {
          DialogCallbacks.instance()[id](actionKey, input);
        } else if (ipcRenderer !== undefined) {
          ipcRenderer.sendSync("fire-dialog-action", id, actionKey, input);
        }
      }
    } catch (err) {
      log("error", "failed to invoke dialog callback", { id, actionKey });
    } finally {
      delete DialogCallbacks.instance()[id];
    }
  };
}

export function closeDialogs(ids: string[], actionKey?: string, input?: any) {
  return (dispatch) => {
    for (const id of ids) {
      dispatch(dismissDialog(id));
      try {
        if (actionKey !== undefined) {
          if (DialogCallbacks.instance()[id] !== undefined) {
            DialogCallbacks.instance()[id](actionKey, input);
          } else if (ipcRenderer !== undefined) {
            ipcRenderer.sendSync("fire-dialog-action", id, actionKey, input);
          }
        }
      } catch (err) {
        log("error", "failed to invoke dialog callback", { id, actionKey });
      } finally {
        delete DialogCallbacks.instance()[id];
      }
    }
  };
}

export function triggerDialogLink(id: string, idx: number) {
  const cbId = `__link-${id}`;
  if (DialogCallbacks.instance()[cbId] !== undefined) {
    DialogCallbacks.instance()[cbId](idx);
  }
}
