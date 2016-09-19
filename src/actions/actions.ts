import { INotification } from '../types/INotification';
import * as Promise from 'bluebird';
import { createAction } from 'redux-act';

/** action to set window size in the store. Takes one parameter of the form {width: number, height: number} */
export const setWindowSize = createAction('change window size');

/** action to set window position in the store. Takes one parameter of the form {x: number, y: number} */
export const setWindowPosition = createAction('change window position');

/**
 * action to set maximized in the store
 * to avoid confusion: maximize maintains window frame and fills one screen,
 * fullscreen makes the window borderless + fill the screen
 */
export const setMaximized = createAction('set window maximized');

/*
 * action to set the logged-in user. Takes two parameters of the form { login: text, password: password}
 */
export const setLoggedInUser = createAction('set the logged-in user to these parameters',
  (username: string, cookie: string) => ({ username, cookie }));

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
