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
}

function createTitle(error: ITermination) {
  return `Crash: ${error.message}`;
}

function createReport(error: ITermination, config: any) {
  return `### Application Crash
#### System
| | |
|------------ | -------------|
|Platform | ${process.platform}|
|Architecture | ${process.arch}|
|Application Version | ${config.version}|
#### Message
${error.message}
#### Details
\`\`\`
${error.details}
\`\`\`
#### Description
<Please describe what you were doing when the crash happened>
`;
}

declare var Notification: any;

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

  let action = dialog.showMessageBox(null, {
    type: 'error',
    buttons: ['Report', 'Quit'],
    title: 'An unrecoverable error occured',
    message: error.message,
    detail: error.details,
    noLink: true,
  });

  if (action === 0) {
    let config = require('../../package.json');
    clipboard.writeText(createReport(error, config));
    const title = encodeURIComponent(createTitle(error));
    const body = 'Please paste the content of your clipboard here and describe what you did '
               + 'when the crash happened.';
    let url = `${config.repository.url}/issues/new?title=${title}&labels[]=bug&body=${body}`;
    log('info', 'create issue report', { url, len: body.length });
    // this assumes it's a github url
    shell.openExternal(url);
  }
  app.exit(1);
}
