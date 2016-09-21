import { INotification } from '../types/INotification';
import * as Promise from 'bluebird';
import { createAction } from 'redux-act';

/**
 * adds a notification to be displayed. Takes one parameter of type INotification. The id may be
 * left unset, in that case one will be generated
 */
export const startNotification = createAction('add a notification');

/**
 * dismiss a notification. Takes the id of the notification
 */
export const dismissNotification = createAction('dismiss notification');

/**
 * show a modal dialog to the user
 */
export const showDialog = createAction('show modal dialog to user',
  (type: string, title: string, message: string) => ({ type, title, message }));

/**
 * dismiss the dialog being displayed
 */
export const dismissDialog = createAction('dismiss modal dialog');

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
