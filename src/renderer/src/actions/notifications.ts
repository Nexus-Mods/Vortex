import { getErrorMessageOrDefault } from "@vortex/shared";
import PromiseBB from "bluebird";
import type { AnyAction } from "redux";
import { createAction } from "redux-act";
import type { ThunkAction } from "redux-thunk";
import { generate as shortid } from "shortid";

import { log } from "@/logging";

import type { DialogActions, DialogType, IDialogContent, IDialogResult } from "../types/IDialog";
import type { INotification, NotificationDismiss } from "../types/INotification";
import local from "../util/local";

export * from "../types/IDialog";

const identity = <T>(input: T): T => input;

/**
 * adds a notification to be displayed. Takes one parameter of type INotification. The id may be
 * left unset, in that case one will be generated
 */
export const startNotification = createAction("ADD_NOTIFICATION", identity);

export const updateNotification = createAction(
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
export const stopNotification = createAction("STOP_NOTIFICATION", identity);

export const stopAllNotifications = createAction("STOP_ALL_NOTIFICATIONS");

/**
 * show a modal dialog to the user
 *
 * don't call this directly, use showDialog
 */
export const addDialog = createAction(
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
export const dismissDialog = createAction("DISMISS_MODAL_DIALOG", identity);

const timers = local<{ [id: string]: ReturnType<typeof setTimeout> }>("notification-timers", {});

type NotificationFunc = (dismiss: NotificationDismiss) => void;
const notificationActions = local<{ [id: string]: NotificationFunc[] }>("notification-actions", {});
const notificationDismissHandlers = local<{ [id: string]: () => void }>(
  "notification-dismiss-handlers",
  {},
);

export function fireNotificationAction(
  notiId: string,
  notiProcess: string,
  action: number,
  dismiss: NotificationDismiss,
) {
  // Action callbacks live in the process that created the notification; there's nothing to invoke
  // for one created in another process.
  if (notiProcess !== process.type) {
    return;
  }
  if (notificationActions[notiId] === undefined) {
    // this can happen if vortex was restarted and so the notification is still in the store but
    // the callbacks are no longer available.
    return;
  }
  const func = notificationActions[notiId]?.[action];
  if (func !== undefined) {
    func(dismiss);
  }
}

let suppressNotification: (id: string) => boolean = () => false;

export function setupNotificationSuppression(cb: (id: string) => boolean) {
  suppressNotification = cb;
}

/**
 * show a notification
 *
 * @public
 */
export function addNotification(
  notification: INotification,
): ThunkAction<Promise<void>, unknown, null, AnyAction> {
  return async (dispatch) => {
    const noti = { ...notification };

    if (noti.id !== undefined && suppressNotification(noti.id)) {
      return;
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

    if (noti.onDismiss !== undefined) {
      notificationDismissHandlers[noti.id] = noti.onDismiss;
    }

    const storeNoti = JSON.parse(JSON.stringify(noti));
    storeNoti.process = process.type;
    storeNoti.actions = (storeNoti.actions || []).map((action) => ({
      title: action.title,
      icon: action.icon,
    }));

    dispatch(startNotification(storeNoti));
    if (noti.id !== undefined && noti.displayMS !== undefined) {
      const currentId = noti.id;
      const currentDisplayMS = noti.displayMS;
      await new Promise<void>((resolve) => {
        timers[currentId] = setTimeout(() => resolve(), currentDisplayMS);
      });

      dispatch(dismissNotification(currentId));
    }
  };
}

export function dismissNotification(id: string): ThunkAction<void, unknown, null, AnyAction> {
  return (dispatch) => {
    const onDismiss = notificationDismissHandlers[id];
    delete timers[id];
    delete notificationActions[id];
    delete notificationDismissHandlers[id];
    dispatch(stopNotification(id));
    onDismiss?.();
  };
}

export function dismissAllNotifications(): ThunkAction<void, unknown, null, AnyAction> {
  return (dispatch) => {
    const ids = Array.from(
      new Set<string>([...Object.keys(timers), ...Object.keys(notificationActions)]),
    );
    ids.forEach((id) => {
      delete timers[id];
      delete notificationActions[id];
    });
    dispatch(stopAllNotifications());
  };
}

type DialogCallback = (actionKey: string, input?: unknown) => void;

// singleton holding callbacks for active dialogs. The
// actual storage is the "global" object so it gets shared between
// all instances of this module (across extensions).
class DialogCallbacks {
  public static instance(): Record<string, DialogCallback> {
    if (global.__dialogCallbacks === undefined) {
      global.__dialogCallbacks = {};
    }

    return global.__dialogCallbacks;
  }
}

/**
 * show a dialog
 * @public
 */
export function showDialog(
  type: DialogType,
  title: string,
  content: IDialogContent,
  actions: DialogActions,
  inId?: string,
): ThunkAction<PromiseBB<IDialogResult>, unknown, null, AnyAction> {
  return (dispatch) => {
    // Returns Bluebird for backwards compatibility with external extensions.
    // Callers within mod_management wrap this in Promise.resolve() to get
    // a native Promise. Migrate to native Promise when extensions are updated.
    return new PromiseBB<IDialogResult>((resolve) => {
      const id = inId || shortid();
      const defaultAction = actions.find((iter) => iter.default === true);
      const defaultLabel = defaultAction !== undefined ? defaultAction.label : undefined;
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
      DialogCallbacks.instance()[id] = (actionKey, input) => {
        const action = actions.find((iter) => iter.label === actionKey);
        if (action?.action) {
          try {
            action.action();
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
      DialogCallbacks.instance()[`__link-${id}`] = (idx) => {
        content.links?.[Number(idx)]?.action(() => {
          dispatch(dismissDialog(id));
        }, content.links[Number(idx)].id);
      };
    });
  };
}

export function closeDialog(
  id: string,
  actionKey?: string,
  input?: unknown,
): ThunkAction<void, unknown, null, AnyAction> {
  return (dispatch) => {
    dispatch(dismissDialog(id));
    try {
      if (actionKey !== undefined) {
        if (DialogCallbacks.instance()[id] !== undefined) {
          DialogCallbacks.instance()[id](actionKey, input);
        }
      }
    } catch {
      log("error", "failed to invoke dialog callback", { id, actionKey });
    } finally {
      delete DialogCallbacks.instance()[id];
    }
  };
}

export function closeDialogs(
  ids: string[],
  actionKey?: string,
  input?: unknown,
): ThunkAction<void, unknown, null, AnyAction> {
  return (dispatch) => {
    for (const id of ids) {
      dispatch(dismissDialog(id));
      try {
        if (actionKey !== undefined) {
          if (DialogCallbacks.instance()[id] !== undefined) {
            DialogCallbacks.instance()[id](actionKey, input);
          }
        }
      } catch {
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
    DialogCallbacks.instance()[cbId](String(idx));
  }
}
