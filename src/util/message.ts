import {
  addNotification,
  IDialogAction,
  IDialogContent,
  showDialog,
} from '../actions/notifications';
import { IErrorOptions } from '../types/IExtensionContext';
import { IState } from '../types/IState';
import { jsonRequest } from '../util/network';

import { sendReport, toError, isOutdated } from './errorHandling';

import { log } from './log';
import { truthy } from './util';

import { IFeedbackResponse } from 'nexus-api';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

const GITHUB_PROJ = 'Nexus-Mods/Vortex';

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
export function showSuccess<S>(dispatch: ThunkDispatch<IState, null, Redux.Action>, message: string, id?: string) {
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
export function showActivity<S>(dispatch: ThunkDispatch<IState, null, Redux.Action>, message: string, id?: string) {
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
export function showInfo<S>(dispatch: ThunkDispatch<IState, null, Redux.Action>, message: string, id?: string) {
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

function genFeedbackText(response: IFeedbackResponse, githubInfo?: any): string {
  const lines = [
    'Thank you for your feedback!',
    '',
    'If you\'re reporting a bug, please don\'t forget to leave additional information in the form that should have opened in your webbrowser.',
    '',
  ];

  if (response.github_issue === undefined) {
    lines.push('Your feedback will be reviewed before it is published.');
  } else {
    if (((githubInfo !== undefined) && (githubInfo.state === 'closed'))
        || response.github_issue.issue_state === 'closed') {
      lines.push('This issue was reported before and seems to be fixed already. If you\'re not running the newest version of Vortex, please update.');
    } else if (((githubInfo !== undefined) && (githubInfo.comments >= 1))
               || (response.count > 1)) {
      lines.push('This is not the first report about this problem, so your report '
               + 'was added as a comment to the existing one.');
    } else {
      lines.push('You were the first to report this issue.');
    }
    const url = genGithubUrl(response.github_issue.issue_number);
    lines.push(`You can review the created issue on [url]${url}[/url]`);
  }

  return lines.join('[br][/br]');
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
export function showError(dispatch: ThunkDispatch<IState, null, Redux.Action>,
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
      hideMessage: (options === undefined) || (options.hideDetails !== false),
    },
    parameters: {
      ...(options !== undefined) ? options.replace : {},
      ...(err.parameters || {}),
    },
  };

  const actions: IDialogAction[] = [];

  if (!isOutdated() && ((options === undefined) || (options.allowReport !== false))) {
    actions.push({
      label: 'Report',
      action: () => sendReport('error', toError(details, options), ['error'], '', process.type)
        .then(response => {
          if (response !== undefined) {
            const githubURL = `https://api.github.com/repos/${GITHUB_PROJ}/issues/${response.github_issue.issue_number}`;
            jsonRequest<any>(githubURL)
              .catch(() => undefined)
              .then(githubInfo => {
                dispatch(showDialog('success', 'Issue reported', {
                  bbcode: genFeedbackText(response, githubInfo),
                }, [{ label: 'Close' }]));
              });
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

function prettifyNodeErrorMessage(err: any) {
  if (err.code === undefined) {
    return { message: err.message, replace: {} };
  } else if (err.code === 'EPERM') {
    const filePath = err.path || err.filename;
    return { message: 'Vortex needs to access "{{filePath}}" is write protected.\n'
            + 'When you configure directories and access rights you need to ensure Vortex can '
            + 'still access data directories.\n'
            + 'This is usually not a bug in Vortex.', replace: { filePath } };
  } else if (err.code === 'ENOENT') {
    const filePath = err.path || err.filename;
    return {
      message: 'Vortex tried to access "{{filePath}}" but it doesn\'t exist.',
      replace: { filePath },
    };
  }
  return {
    message: err.message,
  };
}

function renderCustomError(err: any) {
  const res: { message?: string, text?: string, parameters?: any, wrap: boolean } = { wrap: false };
  if (err === undefined) {
    res.text = 'Unknown error';
  } else if ((err.error !== undefined) && (err.error instanceof Error)) {
    const pretty = prettifyNodeErrorMessage(err.error);
    if (err.message !== undefined) {
      res.text = err.message;
      res.message = pretty.message;
    } else {
      res.text = pretty.message;
    }
    res.parameters = pretty.replace;
  } else {
    res.text = err.message || 'An error occurred';
  }

  let attributes = Object.keys(err)
      .filter(key => key[0].toUpperCase() === key[0]);
  if (attributes.length === 0) {
    attributes = Object.keys(err)
      .filter(key => ['message', 'error'].indexOf(key) === -1);
  }
  if (attributes.length > 0) {
    const old = res.message;
    res.message = attributes
        .map(key => key + ':\t' + err[key])
        .join('\n');
    if (old !== undefined) {
      res.message = old + '\n' + res.message;
    }
  }
  if ((res.message !== undefined) && (res.message.length === 0)) {
    res.message = undefined;
  }
  return res;
}

/**
 * render error message for display to the user
 * @param err 
 */
export function renderError(err: string | Error | any):
    { message?: string, text?: string, parameters?: any, wrap: boolean } {
  if (Array.isArray(err)) {
    err = err[0];
  }
  if (typeof(err) === 'string') {
    return { text: err, wrap: true };
  } else if (err instanceof Error) {
    const errMessage = prettifyNodeErrorMessage(err);
    return {
      text: errMessage.message,
      message: err.stack,
      parameters: errMessage.replace,
      wrap: false,
    };
  } else {
    return renderCustomError(err);
  }
}
