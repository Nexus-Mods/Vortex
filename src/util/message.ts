import {
  addNotification,
  IDialogAction,
  IDialogContent,
  showDialog,
} from '../actions/notifications';
import { IErrorOptions } from '../types/IExtensionContext';
import { IState } from '../types/IState';
import { jsonRequest } from '../util/network';

import { HTTPError } from './CustomErrors';
import { isOutdated, sendReport, toError,
         getErrorContext, didIgnoreError } from './errorHandling';
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
export function showSuccess<S>(dispatch: ThunkDispatch<IState, null, Redux.Action>,
                               message: string,
                               id?: string) {
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
export function showActivity<S>(dispatch: ThunkDispatch<IState, null, Redux.Action>,
                                message: string,
                                id?: string) {
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
export function showInfo<S>(dispatch: ThunkDispatch<IState, null, Redux.Action>,
                            message: string,
                            id?: string) {
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
    'If you\'re reporting a bug, please don\'t forget to leave additional '
      + 'information in the form that should have opened in your webbrowser.',
    '',
  ];

  if (response.github_issue === undefined) {
    lines.push('Your feedback will be reviewed before it is published.');
  } else {
    if (((githubInfo !== undefined) && (githubInfo.state === 'closed'))
        || response.github_issue.issue_state === 'closed') {
      lines.push('This issue was reported before and seems to be fixed already. '
               + 'If you\'re not running the newest version of Vortex, please update.');
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

const noReportErrors = ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNABORTED', 'ENETUNREACH'];

function shouldAllowReport(err: string | Error | any, options?: IErrorOptions): boolean {
  if ((options !== undefined) && (options.allowReport !== undefined)) {
    return options.allowReport;
  }
  if (err.code === undefined) {
    return true;
  }

  return noReportErrors.indexOf(err.code) === -1;
}

/**
 * show an error notification with an optional "more" button that displays further details
 * in a modal dialog.
 *
 * @export
 * @template S
 * @param {Redux.Dispatch<S>} dispatch
 * @param {string} title
 * @param {any} [details] further details about the error (stack and such). The api says we only
 *                        want string or Errors but since some node apis return non-Error objects
 *                        where Errors are expected we have to be a bit more flexible here.
 */
export function showError(dispatch: ThunkDispatch<IState, null, Redux.Action>,
                          title: string,
                          details?: string | Error | any,
                          options?: IErrorOptions) {
  const err = renderError(details);

  const allowReport = err.allowReport !== undefined
    ? err.allowReport
    : shouldAllowReport(details, options);

  log(allowReport ? 'error' : 'warn', title, err);

  const content: IDialogContent = (truthy(options) && options.isHTML) ? {
    htmlText: err.message || err.text,
    options: {
      wrap: false,
    },
  } : (truthy(options) && options.isBBCode) ? {
    bbcode: err.message || err.text,
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

  const context = getErrorContext();

  if (!isOutdated() && !didIgnoreError() && allowReport) {
    actions.push({
      label: 'Report',
      action: () => sendReport('error', toError(details, options), context, ['error'], '', process.type)
        .then(response => {
          if (response !== undefined) {
            const { issue_number } = response.github_issue;
            const githubURL = `https://api.github.com/repos/${GITHUB_PROJ}/issues/${issue_number}`;
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

  let haveMessage = (options !== undefined) && (options.message !== undefined);

  dispatch(addNotification({
    id: (options !== undefined) ? options.id : undefined,
    type: 'error',
    title: haveMessage ? title : undefined,
    message: haveMessage ? options.message : title,
    replace: (options !== undefined) ? options.replace : undefined,
    actions: details !== undefined ? [{
      title: 'More',
      action: (dismiss: () => void) => {
        dispatch(showDialog('error', 'Error', content, actions));
      },
    }] : [],
  }));
}

export interface IPrettifiedError {
  message: string;
  replace?: any;
  allowReport?: boolean;
}

export function prettifyNodeErrorMessage(err: any): IPrettifiedError {
  if (err.code === undefined) {
    return { message: err.message, replace: {} };
  } else if (err.syscall === 'getaddrinfo') {
    return {
      message: 'Network address "{{host}}" could not be resolved. This is often a temporary error, '
             + 'please try again later.',
      replace: { host: err.host || err.hostname },
      allowReport: false,
    };
  } else if (err.code === 'EPERM') {
    const filePath = err.path || err.filename;
    return {
      message: 'Vortex needs to access "{{filePath}}" but it\'s write protected.\n'

            + 'When you configure directories and access rights you need to ensure Vortex can '
            + 'still access data directories.\n'
            + 'This is usually not a bug in Vortex.',
      replace: { filePath },
      allowReport: false,
    };
  } else if (err.code === 'ENOENT') {
    if ((err.path !== undefined) || (err.filename !== undefined)) {
      const filePath = err.path || err.filename;

      return {
        message: 'Vortex tried to access "{{filePath}}" but it doesn\'t exist.',
        replace: { filePath },
        allowReport: false,
      };
    } else if (err.host !== undefined) {
      return {
        message: 'Network address "{{host}}" not found.',
        replace: { host: err.host },
        allowReport: false,
      };
    }
  } else if (err.code === 'ENOSPC') {
    return {
      message: 'The disk is full',
      allowReport: false,
    };
  } else if (err.code === 'ENETUNREACH') {
    return {
      message: 'Network server not reachable.',
      allowReport: false,
    };
  } else if (err.code === 'ECONNABORTED') {
    return {
      message: 'Network connection aborted by the server.',
      allowReport: false,
    };
  } else if (err.code === 'ECONNREFUSED') {
    return {
      message: 'Network connection refused.',
      allowReport: false,
    };
  } else if (err.code === 'ECONNRESET') {
    return {
      message: 'Network connection closed unexpectedly.',
      allowReport: false,
    };
  } else if (err.code === 'ETIMEDOUT') {
    return {
      message: 'Network connection to "{{address}}" timed out, please try again.',
      replace: { address: err.address },
      allowReport: false,
    };
  } else if (err.code === 'EAI_AGAIN') {
    return {
      message: 'Temporary name resolution error, please try again later.',
      allowReport: false,
    };
  } else if (err.code === 'EISDIR') {
    return {
      message: 'Vortex expected a file but found a directory.',
      allowReport: false,
    };
  } else if (err.code === 'ENOTDIR') {
    return {
      message: 'Vortex expected a directory but found a file.',
      allowReport: false,
    };
  } else if (err.code === 'EROFS') {
    return {
      message: 'The filesystem is read-only.',
      allowReport: false,
    };
  } else if (err.code === 'UNKNOWN') {
    return {
      message: 'An unknown error occurred. What this means is that Windows or the framework don\'t '
             + 'provide any useful information to diagnose this problem. '
             + 'Please do not report this issue without saying what exactly you were doing.',
    }
  }

  return {
    message: err.message,
  };
}

interface ICustomErrorType {
  message?: string;
  text?: string;
  parameters?: any;
  allowReport?: boolean;
  wrap: boolean;
}

function renderCustomError(err: any) {
  const res: ICustomErrorType = { wrap: false };
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
    res.allowReport = pretty.allowReport;
  } else {
    res.text = err.message || 'An error occurred';
  }

  let attributes = Object.keys(err || {})
      .filter(key => key[0].toUpperCase() === key[0]);
  if (attributes.length === 0) {
    attributes = Object.keys(err || {})
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

function prettifyHTTPError(err: HTTPError) {
  const fallback = () => {
    const rangeDescription = (err.statusCode >= 500)
      ? 'This code is usually the responsibility of the server and will likely be temporary'
      : (err.statusCode >= 400)
        ? 'This code is usually caused by an invalid request, maybe you followed a link '
          + 'that has expired or you lack permission to access it.'
        : (err.statusCode >= 300)
          ? 'This code indicates the url is no longer valid.'
          : 'This code isn\'t an error and shouldn\'t have been reported';

    return {
      text: 'Requesting url "{{url}}" failed with status "{{statusCode}} {{message}}".\n'
             + rangeDescription,
      parameters: {
        message: err.statusMessage,
        url: err.url,
        statusCode: err.statusCode,
      },
      // 3xx errors are redirections and should have been followed,
      // 2xx aren't errors and shouldn't have been reported.
      allowReport: err.statusCode < 400,
    };
  };

  const func = {
  }[err.statusCode] || fallback;

  return func();
}

/**
 * render error message for display to the user
 * @param err
 */
export function renderError(err: string | Error | any):
    { message?: string, text?: string, parameters?: any, allowReport?: boolean, wrap: boolean } {
  if (Array.isArray(err)) {
    err = err[0];
  }
  if (typeof(err) === 'string') {
    return { text: err, wrap: true };
  } else if (err instanceof HTTPError) {
    return prettifyHTTPError(err);
  } else if (err instanceof Error) {
    const errMessage = prettifyNodeErrorMessage(err);
    return {
      text: errMessage.message,
      message: err.stack,
      parameters: errMessage.replace,
      wrap: false,
      allowReport: errMessage.allowReport,
    };
  } else {
    return renderCustomError(err);
  }
}
