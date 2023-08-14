import { NEXUS_BASE_URL, OAUTH_CLIENT_ID } from '../extensions/nexus_integration/constants';
import { IErrorOptions, IExtensionApi } from '../types/api';
import { IError } from '../types/IError';

import { COMPANY_ID } from './constants';
import { UserCanceled } from './CustomErrors';
import { genHash } from './genHash';
import getVortexPath from './getVortexPath';
import { fallbackTFunc } from './i18n';
import { log } from './log';
import { bundleAttachment } from './message';
import opn from './opn';
import { getSafe } from './storeHelper';
import { flatten, getAllPropertyNames, spawnSelf, truthy } from './util';

import * as RemoteT from '@electron/remote';
import NexusT, { IFeedbackResponse, IOAuthCredentials } from '@nexusmods/nexus-api';
import Promise from 'bluebird';
import {
  BrowserWindow,
  dialog as dialogIn,
  ipcRenderer,
} from 'electron';
import * as fs from 'fs-extra';
import I18next from 'i18next';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import { inspect } from 'util';
import {} from 'uuid';
import { getApplication } from './application';
import lazyRequire from './lazyRequire';

const remote = lazyRequire<typeof RemoteT>(() => require('@electron/remote'));

function createTitle(type: string, error: IError, hash: string) {
  return `${type}: ${error.message}`;
}

interface IErrorContext {
  [id: string]: string;
}

const globalContext: IErrorContext = {};

function isWine() {
  if (process.platform !== 'win32') {
    return false;
  }
  try {
    const winapi = require('winapi-bindings');
    return winapi.IsThisWine();
  } catch (err) {
    return false;
  }
}

function createReport(type: string, error: IError, context: IErrorContext,
                      version: string, reporterProcess: string, sourceProcess: string) {
  let proc: string = reporterProcess || 'unknown';
  if (sourceProcess !== undefined) {
    proc = `${sourceProcess} -> ${proc}`;
  }
  const sections = [
    `#### System
| | |
|------------ | -------------|
|Platform | ${process.platform} ${os.release()} ${isWine() ? '(Wine)' : ''} |
|Architecture | ${process.arch} |
|Application Version | ${version} |
|Process | ${proc} |`,
    `#### Message
${error.message}`,
  ];

  if (error.title) {
    sections.push(`#### Title
\`\`\`
${error.title}
\`\`\`
`);
  }

  if (error.details) {
    sections.push(`#### Details
\`\`\`
${error.details}
\`\`\``);
  }

  if (Object.keys(context).length > 0) {
    sections.push(`#### Context
\`\`\`
${Object.keys(context).map(key => `${key} = ${context[key]}`)}
\`\`\``);
  }

  if (error.path) {
    sections.push(`#### Path
\`\`\`
${error.path}
\`\`\``);
  }

  if (error.stack) {
    sections.push(`#### Stack
\`\`\`
${error.stack}
\`\`\``);
  }

  return `### Application ${type}\n` + sections.join('\n');
}

export function createErrorReport(type: string, error: IError, context: IErrorContext,
                                  labels: string[], state: any, sourceProcess?: string) {
  const userData = getVortexPath('userData');
  const reportPath = path.join(userData, 'crashinfo.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    type, error, labels: labels || [], context,
    token: getSafe(state, ['confidential', 'account', 'nexus', 'OAuthCredentials'], undefined),
    reportProcess: process.type, sourceProcess,
    userData,
  }));
  spawnSelf(['--report', reportPath]);
}

function nexusReport(hash: string, type: string, error: IError, labels: string[],
                     context: IErrorContext, oauthToken: any,
                     reporterProcess: string, sourceProcess: string, attachment: string)
                     : Promise<IFeedbackResponse> {
  const Nexus: typeof NexusT = require('@nexusmods/nexus-api').default;

  const referenceId = require('uuid').v4();

  const oauthCredentials: IOAuthCredentials = (oauthToken !== undefined) ? {
    fingerprint: oauthToken.fingerprint,
    refreshToken: oauthToken.refreshToken,
    token: oauthToken.token,
  } : undefined;

  const config = {
    id: OAUTH_CLIENT_ID,
  };
  const anonymous = (oauthCredentials === undefined);
  return Promise.resolve(Nexus.createWithOAuth(oauthCredentials, config, 'Vortex', getApplication().version, undefined))
    .then(nexus => nexus.sendFeedback(
      createTitle(type, error, hash),
      createReport(type, error, context, getApplication().version, reporterProcess, sourceProcess),
      attachment,
      anonymous,
      hash,
      referenceId))
    .tap(() =>
      opn(`${NEXUS_BASE_URL}/crash-report/?key=${referenceId}`).catch(() => null))
    .catch(err => {
      log('error', 'failed to report error to nexus', err.message);
      return undefined;
    });
}

let fallbackAPIKey: string;
let fallbackOauthToken: any;
let outdated: boolean = false;
let errorIgnored: boolean = false;

export function setApiKey(key: string) {
  fallbackAPIKey = key;
}

export function setOauthToken(token: any) {
  fallbackOauthToken = token;
}

export function setOutdated(api: IExtensionApi) {
  if (process.env.NODE_ENV === 'development') {
    return;
  }
  const state = api.store.getState();
  const version = getApplication().version;
  if (state.persistent.nexus?.newestVersion !== undefined) {
    try {
      outdated = semver.lt(version, state.persistent.nexus.newestVersion);
    } catch (err) {
      // not really a big issue
      log('warn', 'failed to update outdated status', { message: err.message });
    }
  }
  api.onStateChange(['persistent', 'nexus', 'newestVersion'], (prev, next) => {
    outdated = semver.lt(version, next);
  });
}

export function isOutdated(): boolean {
  return outdated;
}

export function didIgnoreError(): boolean {
  return errorIgnored;
}

export function disableErrorReport() {
  log('info', 'user ignored error, disabling reporting');
  errorIgnored = true;
}

if (ipcRenderer !== undefined) {
  ipcRenderer.on('did-ignore-error', () => {
    log('info', 'user ignored error, disabling reporting');
    errorIgnored = true;
  });
}

export function sendReportFile(fileName: string): Promise<IFeedbackResponse> {
  let reportInfo: any;
  return Promise.resolve(fs.readFile(fileName, { encoding: 'utf8' }))
    .then(reportData => {
      reportInfo = JSON.parse(reportData.toString());
      const userData = reportInfo['userData'] ?? getVortexPath('userData');
      // currently attaching a log for any crash-type report
      // if (reportInfo.error.attachLog) {
      return bundleAttachment({
        attachments: [{
          id: 'logfile',
          type: 'file',
          data: path.join(userData, 'vortex.log'),
          description: 'Vortex Log',
        }, {
          id: 'logfile2',
          type: 'file',
          data: path.join(userData, 'vortex1.log'),
          description: 'Vortex Log (old)',
        }],
      });
    })
    .then(attachment => {
      const { type, error, labels, token, reportProcess, sourceProcess, context } = reportInfo;
      return sendReport(type, error, context, labels, token,
        reportProcess, sourceProcess, attachment);
    });
}

export function sendReport(type: string, error: IError, context: IErrorContext,
                           labels: string[],
                           reporterToken: any, reporterProcess: string,
                           sourceProcess: string, attachment: string): Promise<IFeedbackResponse> {
  const dialog = process.type === 'renderer' ? remote.dialog : dialogIn;
  const hash = genHash(error);
  if (process.env.NODE_ENV === 'development') {
    const fullMessage = error.title !== undefined
      ? error.message + `\n(${error.title})`
      : error.message;
    dialog.showErrorBox(fullMessage, JSON.stringify({
      type, error, labels, context, reporterProcess, sourceProcess,
      attachment,
    }, undefined, 2));
    return Promise.resolve(undefined);
  } else {
    return nexusReport(hash, type, error, labels, context, reporterToken || fallbackOauthToken,
                       reporterProcess, sourceProcess, attachment);
  }
}

let defaultWindow: BrowserWindow = null;

export function setWindow(window: BrowserWindow): void {
  defaultWindow = window;
}

export function getWindow(): BrowserWindow {
  return defaultWindow;
}

let currentWindow: BrowserWindow;

function getCurrentWindow() {
  if (currentWindow === undefined) {
    currentWindow = process.type === 'renderer'
      ? remote.getCurrentWindow() : null;
  }

  return currentWindow;
}

export function getVisibleWindow(win?: BrowserWindow): BrowserWindow | null {
  if (!truthy(win)) {
    win = getCurrentWindow() ?? getWindow();
  }

  return ((win !== null) && !win.isDestroyed() && win.isVisible())
    ? win
    : null;
}

function showTerminateError(error: IError, state: any, source: string,
                            allowReport: boolean, withDetails: boolean)
                            : boolean {
  const dialog = process.type === 'renderer' ? remote.dialog : dialogIn;
  const buttons = ['Ignore', 'Quit'];
  if (!withDetails) {
    buttons.unshift('Show Details');
  }
  if ((allowReport !== false) && !outdated && !errorIgnored) {
    buttons.push('Report and Quit');
  }

  const contextNow = { ...globalContext };

  let detail: string = error.details;
  if (withDetails) {
    detail = (error.stack || '');
    if (error.path) {
      detail = 'File: ' + error.path + '\n' + detail;
    }
    if (error.code) {
      detail = error.code + '\n' + detail;
    }
    if (error.details) {
      detail = error.details + '\n' + detail;
    }
  }

  let action = dialog.showMessageBoxSync(getVisibleWindow(), {
    type: 'error',
    buttons,
    defaultId: buttons.length - 1,
    title: 'An unrecoverable error occurred',
    message: error.message,
    detail,
    noLink: true,
  });

  if (buttons[action] === 'Report and Quit') {
    // Report
    createErrorReport('Crash', error, contextNow, ['bug', 'crash'], state, source);
  } else if (buttons[action] === 'Ignore') {
    // Ignore
    action = dialog.showMessageBoxSync(getVisibleWindow(), {
      type: 'error',
      buttons: ['Quit', 'I understand'],
      title: 'Are you sure?',
      message:  'The error was unhandled which may lead to unforseen consequences including data loss. ' + 
                'Continue at your own risk. Please do not report any issues that arise from here on out, as they are very likely to be caused by the unhandled error. ',
      noLink: true,
    });
    if (action === 1) {
      log('info', 'user ignored error, disabling reporting');
      errorIgnored = true;
      return true;
    }
  } else if (buttons[action] === 'Show Details') {
    return showTerminateError(error, state, source, allowReport, true);
  }
  return false;
}

/**
 * display an error message and quit the application
 * on confirmation.
 * Use this whenever the application state is unknown and thus
 * continuing could lead to data loss
 *
 * @export
 * @param {ITermination} error
 */
export function terminate(error: IError, state: any, allowReport?: boolean, source?: string) {
  const dialog = process.type === 'renderer' ? remote.dialog : dialogIn;
  let win = process.type === 'renderer' ? remote.getCurrentWindow() : defaultWindow;
  if (truthy(win) && (win.isDestroyed() || !win.isVisible())) {
    win = null;
  }

  if ((allowReport === undefined) && (error.allowReport === false)) {
    allowReport = false;
  }

  if ((allowReport === undefined) && (error.extension !== undefined)) {
    allowReport = error.extension === COMPANY_ID;
  }

  log('error', 'unrecoverable error', { error, process: process.type });

  try {
    if (showTerminateError(error, state, source, allowReport, false)) {
      // ignored
      return;
    }

    if (error.extension !== undefined) {
      const action = dialog.showMessageBoxSync(getVisibleWindow(), {
        type: 'error',
        buttons: ['Disable', 'Keep'],
        title: 'Extension crashed',
        message: `This crash was caused by an extension (${error.extension}). ` +
                 'Do you want to disable this extension? All functionality provided '
                 + 'by the extension will be removed from Vortex!',
        noLink: true,
      });
      if (action === 0) {
        log('warn', 'extension will be disabled after causing a crash', {
          extId: error.extension,
          error: error.message,
          stack: error.stack,
        });
        // can't access the store at this point because we won't be waiting for the store
        // to be persisted
        fs.writeFileSync(path.join(getVortexPath('temp'), '__disable_' + error.extension), '');
      }
    }
  } catch (err) {
    // if the crash occurs before the application is ready, the dialog module can't be
    // used (except for this function)
    dialog.showErrorBox('An unrecoverable error occurred',
      error.message + '\n' + error.details +
      '\nIf you think this is a bug, please report it to the ' +
      'issue tracker (github)');
  }

  getApplication().quit(1);
  throw new UserCanceled();
}

/**
 * render error message for internal processing (issue tracker and such).
 * It's important this doesn't translate the error message or lose information
 */
export function toError(input: any, title?: string,
                        options?: IErrorOptions, sourceStack?: string): IError {
  let ten = I18next.getFixedT('en');
  try {
    ten('dummy');
  } catch (err) {
    // can't actually be sure if i18next is initialized - especially if this is the
    // main process. We could use require('i18next').isInitialized but no clue if
    // that's reliable.
    ten = fallbackTFunc;
  }

  const subtitle = (options || {}).message;

  /* i18next-extract-disable-next-line */
  const t = (text: string) => ten(text, { replace: (options || {}).replace });

  if (input instanceof Error) {
    let stack = input.stack;
    if (sourceStack !== undefined) {
      stack += '\n\nReported from:\n' + sourceStack;
    }
    const flatErr = flatten(input);
    return {
      /* i18next-extract-disable-next-line */
      message: t(input.message),
      title,
      subtitle,
      stack,
      allowReport: input['allowReport'],
      details: Object.keys(flatErr)
        .filter(key => key !== 'allowReport')
        .map(key => `${key}: ${flatErr[key]}`)
        .join('\n'),
    };
  }

  switch (typeof input) {
    case 'object': {
      // object, but not an Error
      let message: string;
      let stack: string;
      if (!truthy(input) || (getAllPropertyNames(input).length === 0)) {
        // this is bad...
        message = `An empty error message was thrown: "${inspect(input)}"`;
      } else if ((input.error !== undefined) && (input.error instanceof Error)) {
        message = input.error.message;
        stack = input.error.stack;
      } else {
        message = input.message;
        if (input.message === undefined) {
          if (input.error !== undefined) {
            // not sure what this is but need to ensure not to drop any information
            message = inspect(input.error);
          } else if (Object.keys(input).length > 0) {
            // wtf is this???
            message = inspect(input);
          } else {
            message = 'An error occurred';
          }
        }
        stack = input.stack;
      }

      if (sourceStack !== undefined) {
        if (stack === undefined) {
          stack = sourceStack;
        } else {
          stack += '\n\nReported from:\n' + sourceStack;
        }
      }

      const flatErr = flatten(input);

      let attributes = Object.keys(flatErr || {})
          .filter(key => key[0].toUpperCase() === key[0]);
      // if there are upper case characters, this is a custom, not properly typed, error object
      // with upper case attributes, intended to be displayed to the user.
      // Otherwise, who knows what this is, just send everything.
      if (attributes.length === 0) {
        attributes = getAllPropertyNames(flatErr || {})
          .filter(key => ['message', 'error', 'stack', 'context'].indexOf(key) === -1);
      }

      const details = attributes.length === 0 ? undefined : attributes
          .map(key => key + ':\t' + input[key])
          .join('\n');

      return {message, title, subtitle, stack, details};
    }
    case 'string': {
      /* i18next-extract-disable-next-line */
      return { message: 'String exception: ' + t(input), title, subtitle };
    }
    default: {
      return { message: 'Unknown exception: ' + inspect(input), title, subtitle };
    }
  }
}

/**
 * set an error context, that will be reported with every error reported.
 * Please keep in mind that the error context will remain set
 * until it's cleared with clearErrorContext and use "withContext" where possible
 * to ensure the context gets reset
 * @param id context id
 * @param value context value
 */
export function setErrorContext(id: string, value: string) {
  globalContext[id] = value;
}

/**
 * clear an error context
 * @param id id of the context
 */
export function clearErrorContext(id: string) {
  delete globalContext[id];
}

/**
 * execute a function with the specified error context
 * @param id identifier of the context to set
 * @param value context value
 * @param fun the function to set
 */
export function withContext(id: string, value: string, fun: () => Promise<any>) {
  setErrorContext(id, value);
  return fun().finally(() => {
    clearErrorContext(id);
  });
}

/**
 * attach context to an error that may be caught after the global context has been reset
 * @param err the error to add context to
 */
export function contextify(err: Error): Error {
  (err as any).context = getErrorContext();
  return err;
}

export function getErrorContext(): IErrorContext {
  return { ...globalContext };
}
