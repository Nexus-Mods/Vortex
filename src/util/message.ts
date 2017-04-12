import { addNotification, showDialog } from '../actions/notifications';

import { createErrorReport } from './errorHandling';

import { log } from './log';

function clamp(min: number, value: number, max: number): number {
  return Math.max(max, Math.min(min, value));
}

/**
 * calculate a reasonable time to display a message based on the
 * amount of text.
 * This is quite crude because the reading speed differs between languages.
 * Japanese and Chinese for example where a single symbol has much more meaning
 * than a latin character the reading speed per symbol will be lower.
 * 
 * @export
 * @param {number} messageLength
 * @returns
 */
export function calcDuration(messageLength: number) {
  return clamp(2000, messageLength * 50, 7000);
}

/**
 * show a notification that some operation succeeded. This message has a timer based on
 * the message length
 * 
 * @export
 * @template S
 * @param {Redux.Dispatch<S>} dispatch
 * @param {string} message
 * @param {string} [id]
 */
export function showSuccess<S>(dispatch: Redux.Dispatch<S>, message: string, id?: string) {
  // show message for 2 to 7 seconds, depending on message length
  dispatch(addNotification({
    id,
    type: 'success',
    message,
    displayMS: calcDuration(message.length),
  }));
}

/**
 * show an info notification. Please don't use this for important stuff as the message
 * has a timer based on message length
 * 
 * @export
 * @template S
 * @param {Redux.Dispatch<S>} dispatch
 * @param {string} message
 * @param {string} [id]
 */
export function showInfo<S>(dispatch: Redux.Dispatch<S>, message: string, id?: string) {
  // show message for 2 to 7 seconds, depending on message length
  dispatch(addNotification({
    id,
    type: 'info',
    message,
    displayMS: calcDuration(message.length),
  }));
}

/**
 * show an error notification with an optional "more" button that displays further details
 * in a modal dialog.
 * 
 * @export
 * @template S
 * @param {Redux.Dispatch<S>} dispatch
 * @param {string} message
 * @param {any} [details] further details about the error (stack and such). The api says we only
 *                        want string or Errors but since some node apis return non-Error objects
 *                        where Errors are expected we have to be a bit more flexible here. 
 */
export function showError<S>(dispatch: Redux.Dispatch<S>, message: string,
                             details?: string | Error | any,
                             isHTML: boolean = false) {
  const finalDetails: string = renderError(details);

  log('error', message, finalDetails);

  const content = isHTML ? {
    htmlText: finalDetails,
    options: {
      wrap: false,
    },
  } : {
    message: finalDetails,
    options: {
      wrap: false,
    },
  };

  dispatch(addNotification({
    type: 'error',
    message,
    actions: details !== undefined ? [{
      title: 'More',
      action: (dismiss: Function) => {
        dispatch(showDialog('error', 'Error', content, {
          Report: () => createErrorReport('Error', {
            message,
            details: finalDetails,
          }, ['bug']),
          Close: null,
        }));
      },
    }] : [],
  }));
}

function renderNodeError(err: Error): string {
  let res: string[] = [];

  if (Array.isArray(err)) {
    err = err[0];
  }

  if (err.message) {
    res.push(err.message);
  }

  if (err.stack) {
    res.push(err.stack);
  }

  return res.join('\n');
}

function renderCustomError(err: any): string {
  if (err === undefined) {
    return 'Unknown error';
  }
  return Object.keys(err).map((key: string) => {
    return key + ':\t' + err[key];
  }).join('\n');
}

function renderError(err: string | Error | any): string {
  if (typeof(err) === 'string') {
    return err;
  } else if (err instanceof Error) {
    return renderNodeError(err);
  } else {
    return renderCustomError(err);
  }
}
