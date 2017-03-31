import {
  app as appIn,
  clipboard,
  dialog as dialogIn,
  remote,
  shell,
} from 'electron';

import {log} from './log';

export interface ITermination {
  message: string;
  details?: string;
  stack?: string;
}

// could be a bit more dynamic but how often is this going to change?
const repo = 'https://github.com/Nexus-Mods/NMM2';

function createTitle(type: string, error: ITermination) {
  return `${type}: ${error.message}`;
}

function createReport(type: string, error: ITermination, version: string) {
  return `### Application ${type}
#### System
| | |
|------------ | -------------|
|Platform | ${process.platform} |
|Architecture | ${process.arch} |
|Application Version | ${version} |
#### Message
${error.message}
#### Details
\`\`\`
${error.details}
\`\`\`
#### Steps to reproduce
<Please describe what you were doing when the crash happened>
`;
}

declare var Notification: any;

export function createErrorReport(type: string, error: ITermination, labels: string[] = []) {
  const app = appIn || remote.app;

  clipboard.writeText(createReport(type, error, app.getVersion()));
  const title = encodeURIComponent(createTitle(type, error));
  const body =
      'Please paste the content of your clipboard here and describe what you did ' +
      'when the error happened.';

  let labelFragments = labels.map((str: string) => `labels[]=${str}`).join('&');

  let url = `${repo}/issues/new?title=${title}&${labelFragments}&body=${body}`;
  shell.openExternal(url);
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
export function terminate(error: ITermination) {
  const app = appIn || remote.app;
  const dialog = dialogIn || remote.dialog;

  log('error', 'unrecoverable error', error);

  try {
    let action = dialog.showMessageBox(null, {
      type: 'error',
      buttons: ['Report', 'Ignore', 'Quit'],
      title: 'An unrecoverable error occured',
      message: error.message,
      detail: error.details + '\n' + error.stack,
      noLink: true,
    });

    if (action === 0) {
      createErrorReport('Crash', error, ['bug', 'crash']);
    } else if (action === 1) {
      action = dialog.showMessageBox(null, {
        type: 'error',
        buttons: ['Quit', 'I won\'t whine'],
        title: 'Are you sure?',
        message: 'This error was unhandled and so there is ' +
                 'no way to know what subsequent errors this ' +
                 'may cause. You may lose data!\n' +
                 'We ask that you refrain from reporting issues ' +
                 'that happen from here on out in this session.',
        noLink: true,
      });
      if (action === 1) {
        return;
      }
    }
  } catch (err) {
    // if the crash occurs before the application is ready, the dialog module can't be
    // used (except for this function)
    dialog.showErrorBox('An unrecoverable error occured',
      error.message + '\n' + error.details +
      '\nIf you think this is a bug, please report it to the ' +
      'issue tracker');
  }

  app.exit(1);
}
