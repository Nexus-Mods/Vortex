import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../types/IDialog';
import { INotification } from '../types/INotification';
import * as Promise from 'bluebird';
import { v1 } from 'node-uuid';
import { createAction } from 'redux-act';

/**
 * adds a notification to be displayed. Takes one parameter of type INotification. The id may be
 * left unset, in that case one will be generated
 * TODO: this stores a function into the store which seems to work but isn't supported
 */
export const startNotification = createAction('ADD_NOTIFICATION');

/**
 * dismiss a notification. Takes the id of the notification
 */
export const dismissNotification = createAction('DISMISS_NOTIFICATION');

/**
 * show a modal dialog to the user
 *
 * don't call this directly, use showDialog
 */
export const addDialog = createAction(
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
export const dismissDialog = createAction('DISMISS_MODAL_DIALOG');

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

let dialogCallbacks = {};

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
      const id = v1();
      dispatch(addDialog(id, type, title, content, Object.keys(actions)));
      dialogCallbacks[id] = (actionKey: string, input?: any) => {
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
    dialogCallbacks[id](actionKey, input);
    delete dialogCallbacks[id];
  };
}
