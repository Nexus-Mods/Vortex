import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../types/IDialog';
import { INotification } from '../types/INotification';
import {log} from '../util/log';

import safeCreateAction from './safeCreateAction';

import * as Promise from 'bluebird';
import { generate as shortid } from 'shortid';

export * from '../types/IDialog';

/**
 * adds a notification to be displayed. Takes one parameter of type INotification. The id may be
 * left unset, in that case one will be generated
 * TODO: this stores a function into the store which seems to work but isn't supported
 */
export const startNotification = safeCreateAction('ADD_NOTIFICATION');

/**
 * dismiss a notification. Takes the id of the notification
 */
export const dismissNotification = safeCreateAction('DISMISS_NOTIFICATION');

/**
 * show a modal dialog to the user
 *
 * don't call this directly, use showDialog
 */
export const addDialog = safeCreateAction(
    'SHOW_MODAL_DIALOG',
    (id: string, type: string, title: string, content: IDialogContent, actions: string[]) =>
        ({id, type, title, content, actions}));

/**
 * dismiss the dialog being displayed
 * 
 * don't call this directly especially when you used "showDialog" to create the dialog or
 * you leak (a tiny amount of) memory and the action callbacks aren't called.
 * Use closeDialog instead
 */
export const dismissDialog = safeCreateAction('DISMISS_MODAL_DIALOG');

/**
 * 
 * 
 * @export
 * @param {INotification} notification
 * @returns
 */
export function addNotification(notification: INotification) {
  return (dispatch) => {
    dispatch(startNotification(notification));
    if (notification.displayMS !== undefined) {
      return new Promise((resolve) => {
        setTimeout(() =>
          resolve()
          , notification.displayMS);
      }).then(() =>
        dispatch(dismissNotification(notification.id))
      );
    }
  };
}

// TODO I don't like the use of a global, but I don't see how else we can ensure
//  the same object is used between main application and extensions, without adding
//  another parameter to functions
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
 * @param {DialogActions} actions
 * @returns
 */
export function showDialog(type: DialogType, title: string,
                           content: IDialogContent, actions: DialogActions) {
  return (dispatch) => {
    return new Promise<IDialogResult>((resolve, reject) => {
      const id = shortid();
      dispatch(addDialog(id, type, title, content, Object.keys(actions)));
      DialogCallbacks.instance()[id] = (actionKey: string, input?: any) => {
        if (actions[actionKey] != null) {
          actions[actionKey](input);
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
