import { INotification } from '../types/INotification';
import * as Promise from 'bluebird';
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
 */
export const showDialog = createAction('SHOW_MODAL_DIALOG',
  (type: string, title: string, message: string) => ({ type, title, message }));

/**
 * dismiss the dialog being displayed
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
