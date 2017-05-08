import * as Promise from 'bluebird';
import { spawn } from 'child_process';
import {
  app as appIn,
  clipboard,
  dialog as dialogIn,
  remote,
  shell,
} from 'electron';
import * as fs from 'fs-extra-promise';
import * as restT from 'node-rest-client';
import * as path from 'path';

import {log} from './log';

export interface ITermination {
  message: string;
  details?: string;
  stack?: string;
}

// could be a bit more dynamic but how often is this going to change?
const repo = 'Nexus-Mods/NMM2';
const repoURL = 'https://github.com/' + repo;

function createTitle(type: string, error: ITermination, hash: string) {
  return `${type}: ${error.message} (hash: ${hash})`;
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

function genHash(error: ITermination) {
  const { createHash } = require('crypto');
  const hash = createHash('md5');
  if (error.stack) {
    return hash.update(error.stack).digest('hex');
  } else {
    return hash.update(error.message).digest('hex');
  }
}

function spawnSelf(args: string[]) {
  const app = appIn || remote.app;
  if (process.execPath.endsWith('electron.exe')) {
    // development version
    args = [path.resolve(__dirname, '..', '..')].concat(args);
  }
  spawn(process.execPath, args, {
    detached: true,
  });
}

export function createErrorReport(type: string, error: ITermination, labels: string[] = []) {
  const app = appIn || remote.app;
  const reportPath = path.join(app.getPath('userData'), 'crashinfo.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    type, error, labels}));
  spawnSelf(['--report', reportPath]);
}

export function sendReport(fileName: string) {
  return fs.readFileAsync(fileName)
    .then(reportData => {
    const {type, error, labels} = JSON.parse(reportData.toString());
    return new Promise((resolve, reject) => {
      const hash = genHash(error);

      const {Client} = require('node-rest-client') as typeof restT;
      const client = new Client();
      client.get(
          `https://api.github.com/repos/${repo}/search/issues`,
          {
            q: hash,
          },
          (data, response) => {
            const app = appIn || remote.app;
            const dialog = dialogIn || remote.dialog;

            let url: string;
            if ((response.statusCode === 200) && (data.items.length > 0)) {
              const action = dialog.showMessageBox(null, {
                type: 'error',
                buttons: ['Take me there'],
                title: 'Already reported',
                message: 'It appears this exact issue was already reported.',
                noLink: true,
              });
              url = data.items[0].html_url;
            } else {
              clipboard.writeText(createReport(type, error, app.getVersion()));

              const title = encodeURIComponent(createTitle(type, error, hash));
              const body =
                  'Please paste the content of your clipboard here and describe what you did ' +
                  'when the error happened.';

              const labelFragments =
                  labels.map((str: string) => `labels[]=${str}`).join('&');

              url =
                  `${repoURL}/issues/new?title=${title}&${labelFragments}&body=${body}`;
            }
            shell.openExternal(url);
            resolve();
          });
    });
  });
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
      // Report
      createErrorReport('Crash', error, ['bug', 'crash']);
      app.exit(1);
    } else if (action === 1) {
      // Ignore
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
      if (action === 0) {
        app.exit(1);
      }
    } else {
      // Quit
      app.exit(1);
    }
  } catch (err) {
    // if the crash occurs before the application is ready, the dialog module can't be
    // used (except for this function)
    dialog.showErrorBox('An unrecoverable error occured',
      error.message + '\n' + error.details +
      '\nIf you think this is a bug, please report it to the ' +
      'issue tracker (github)');
  }
}
