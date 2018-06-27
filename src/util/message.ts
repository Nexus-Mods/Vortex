import {
  addNotification,
  IDialogAction,
  IDialogContent,
  showDialog,
} from '../actions/notifications';

import { sendReport, toError } from './errorHandling';

import { log } from './log';
import { truthy } from './util';

import { IFeedbackResponse } from 'nexus-api';
import * as Redux from 'redux';
import {} from 'redux-thunk';

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
 * show activity notification
 */
export function showActivity<S>(dispatch: Redux.Dispatch<S>, message: string, id?: string) {
  dispatch(addNotification({
    id,
    type: 'activity',
    message,
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

function genGithubUrl(issueId: number) {
  return `https://github.com/Nexus-Mods/Vortex/issues/${issueId}`;
}

function genFeedbackText(response: IFeedbackResponse): string {
  const lines = [
    'Thank you for your feedback!',
    '',
  ];

  if (response.github_issue === undefined) {
    lines.push('Your feedback will be reviewed before it is published.');
  } else {
    if (response.github_issue.issue_state === 'closed') {
      lines.push('This issue was reported before and seems to be fixed already.');
    } else if (response.count > 1) {
      lines.push('This is not the first report about this problem, so your report '
               + 'was added as a comment to the existing one.');
    } else {
      lines.push('You were the first to report this issue.');
    }
    const url = genGithubUrl(response.github_issue.id);
    lines.push(`You can review the created issue on [url]${url}[/url]`);
  }

  return lines.join('[br][/br]');
}

export interface IErrorOptions {
  replace?: { [key: string]: string };
  isHTML?: boolean;
  id?: string;
  allowReport?: boolean;
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
export function showError<S>(dispatch: Redux.Dispatch<S>,
                             message: string,
                             details?: string | Error | any,
                             options?: IErrorOptions) {
  const err = renderError(details);

  log('error', message, err);

  const content: IDialogContent = (truthy(options) && options.isHTML) ? {
    htmlText: err.message || err.text,
    options: {
      wrap: false,
    },
  } : {
    text: err.text,
    message: err.message,
    options: {
      wrap: err.wrap,
    },
    parameters: (options !== undefined) ? options.replace : undefined,
  };

  const actions: IDialogAction[] = [];

  if ((options === undefined) || (options.allowReport !== false)) {
    actions.push({
      label: 'Report',
      action: () => sendReport('error', toError(details, options), ['error'], '')
        .then(response => {
          if (response !== undefined) {
            dispatch(showDialog('success', 'Issue reported', {
              bbcode: genFeedbackText(response),
            }, [ { label: 'Close' } ]));
          }
        }),
    });
  }

  actions.push({ label: 'Close', default: true });

  dispatch(addNotification({
    id: (options !== undefined) ? options.id : undefined,
    type: 'error',
    message,
    replace: (options !== undefined) ? options.replace : undefined,
    actions: details !== undefined ? [{
      title: 'More',
      action: (dismiss: () => void) => {
        dispatch(showDialog('error', 'Error', content, actions));
      },
    }] : [],
  }));
}

function renderNodeError(err: Error): string {
  const res: string[] = [];

  if (Array.isArray(err)) {
    err = err[0];
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
  return Object.keys(err)
      .filter(key => ['fatal'].indexOf(key) === -1)
      .map(key => key + ':\t' + err[key])
      .join('\n');
}

function renderError(err: string | Error | any):
    { message?: string, text?: string, wrap: boolean } {
  if (typeof(err) === 'string') {
    return { text: err, wrap: true };
  } else if (err instanceof Error) {
    if ((err as any).code === 'EPERM') {
      return {
        text: 'A file that Vortex needs to access is write protected.\n'
            + 'When you configure directories and access rights you need to ensure Vortex can '
            + 'still access data directories.\n'
            + 'This is usually not a bug in Vortex.',
        message: (err as any).path + '\n' + err.stack,
        wrap: false,
      };
    } else {
      return { text: err.message, message: renderNodeError(err), wrap: false };
    }
  } else {
    return { message: renderCustomError(err), wrap: false };
  }
}
