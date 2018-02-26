import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../types/IDialog';
import { INotification } from '../types/INotification';
import local from '../util/local';
import {log} from '../util/log';
import {truthy} from '../util/util';

import safeCreateAction from './safeCreateAction';

import * as Promise from 'bluebird';
import * as reduxAct from 'redux-act';

import { generate as shortid } from 'shortid';

export * from '../types/IDialog';

const identity = input => input;

/**
 * adds a notification to be displayed. Takes one parameter of type INotification. The id may be
 * left unset, in that case one will be generated
 * TODO: this stores a function into the store which seems to work but isn't supported
 */
export const startNotification = safeCreateAction('ADD_NOTIFICATION', identity);

/**
 * dismiss a notification. Takes the id of the notification
 */
export const dismissNotification = safeCreateAction('DISMISS_NOTIFICATION', identity);

/**
 * show a modal dialog to the user
 *
 * don't call this directly, use showDialog
 */
export const addDialog = safeCreateAction(
    'SHOW_MODAL_DIALOG',
    (id: string, type: string, title: string, content: IDialogContent,
     defaultAction: string, actions: string[]) =>
        ({id, type, title, content, defaultAction, actions}));

/**
 * dismiss the dialog being displayed
 *
 * don't call this directly especially when you used "showDialog" to create the dialog or
 * you leak (a tiny amount of) memory and the action callbacks aren't called.
 * Use closeDialog instead
 */
export const dismissDialog = safeCreateAction('DISMISS_MODAL_DIALOG', identity);

const timers = local<{ [id: string]: NodeJS.Timer }>('notification-timers', {});

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
    if (noti.id === undefined) {
      noti.id = shortid();
    } else if (timers[noti.id] !== undefined) {
      // if this notification is replacing an active one with a timeout,
      // stop that timeout
      clearTimeout(timers[noti.id]);
      delete timers[noti.id];
    }
    dispatch(startNotification(noti));
    if (noti.displayMS !== undefined) {
      return new Promise((resolve) => {
        timers[noti.id] = setTimeout(() =>
          resolve()
          , noti.displayMS);
      }).then(() => {
        delete timers[noti.id];
        dispatch(dismissNotification(noti.id));
      });
    }
  };
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
export function showDialog(type: DialogType, title: string,
                           content: IDialogContent, actions: DialogActions) {
  return (dispatch) => {
    return new Promise<IDialogResult>((resolve, reject) => {
      const id = shortid();
      const defaultAction = actions.find(iter => iter.default === true);
      const defaultLabel = defaultAction !== undefined ? defaultAction.label : undefined;
      dispatch(addDialog(id, type, title, content, defaultLabel,
                         actions.map(action => action.label)));
      DialogCallbacks.instance()[id] = (actionKey: string, input?: any) => {
        const action = actions.find(iter => iter.label === actionKey);
        if (truthy(action.action)) {
          action.action(input);
        }
        resolve({ action: actionKey, input });
      };
    });
  };
}

export function closeDialog(id: string, actionKey: string, input: any) {
  return (dispatch) => {
    dispatch(dismissDialog(id));
    try {
      if (DialogCallbacks.instance()[id] !== null) {
        DialogCallbacks.instance()[id](actionKey, input);
      }
    } catch (err) {
      log('error', 'failed to invoke dialog callback', { id, actionKey });
    } finally {
      delete DialogCallbacks.instance()[id];
    }
  };
}
