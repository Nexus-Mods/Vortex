import { IError } from '../types/IError';

import {log} from './log';
import { spawnSelf } from './util';

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
import NexusT from 'nexus-api';
import * as opn from 'opn';
import * as path from 'path';
import * as uuid from 'uuid';

// could be a bit more dynamic but how often is this going to change?
const repo = 'Nexus-Mods/Vortex-Private';
const repoURL = 'https://github.com/' + repo;

function createTitle(type: string, error: IError, hash: string) {
  return `${type}: ${error.message} (hash: ${hash})`;
}

function createReport(type: string, error: IError, version: string) {
  const sections = [
    `#### System
| | |
|------------ | -------------|
|Platform | ${process.platform} |
|Architecture | ${process.arch} |
|Application Version | ${version} |`,
    `#### Message
${error.message}`,
  ];

  if (error.details) {
    sections.push(`#### Details
\`\`\`
${error.details}
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

function genHash(error: IError) {
  const { createHash } = require('crypto');
  const hash = createHash('md5');
  if (error.stack !== undefined) {
    // when we have a stack we don't want local paths in the part that is hashed,
    // otherwise it will definitively be different between each user. This should
    // remove file names from the stack while keeping function names.
    const hashStack = error.stack
      .split('\n')
      .map(line => line.replace(/\([^)]*\)$/, ''))
      .join('\n');
    return hash.update(hashStack).digest('hex');
  } else {
    return hash.update(error.message).digest('hex');
  }
}

export function createErrorReport(type: string, error: IError, labels: string[] = []) {
  const app = appIn || remote.app;
  const reportPath = path.join(app.getPath('userData'), 'crashinfo.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    type, error, labels}));
  spawnSelf(['--report', reportPath]);
}

// unused code for reporting to github directly
// TODO: remove eventually. If this gets reactivated for some reason, please replace
//   node-rest-client with request
/*
function githubReport(hash: string, type: string, error: IError, labels: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const { Client } = require('node-rest-client') as typeof restT;
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
}
*/

function nexusReport(hash: string, type: string, error: IError, labels: string[]): Promise<void> {
  const app = appIn || remote.app;
  const Nexus: typeof NexusT = require('nexus-api').default;

  const referenceId = uuid.v4();
  const nexus = new Nexus(undefined, '');
  return nexus.sendFeedback(
    createReport(type, error, app.getVersion()),
    undefined,
    true,
    hash,
    referenceId,
  ).then(() => opn(`http://rd.nexusmods.com/crash-report/?key=${referenceId}`));
}

export function sendReport(fileName: string): Promise<void> {
  return fs.readFileAsync(fileName)
    .then(reportData => {
    const {type, error, labels} = JSON.parse(reportData.toString());
    const hash = genHash(error);
    return nexusReport(hash, type, error, labels);
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
export function terminate(error: IError) {
  const app = appIn || remote.app;
  const dialog = dialogIn || remote.dialog;

  log('error', 'unrecoverable error', error);

  try {
    let action = dialog.showMessageBox(null, {
      type: 'error',
      buttons: ['Ignore', 'Quit', 'Report and Quit'],
      defaultId: 2,
      title: 'An unrecoverable error occured',
      message: error.message,
      detail: error.details + '\n' + (error.stack || 'No stack'),
      noLink: true,
    });

    if (action === 2) {
      // Report
      createErrorReport('Crash', error, ['bug', 'crash']);
    } else if (action === 0) {
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
      if (action === 1) {
        return;
      }
    }
    if (error.extension !== undefined) {
      action = dialog.showMessageBox(null, {
        type: 'error',
        buttons: ['Disable', 'Keep'],
        title: 'Extension crashed',
        message: `This crash was caused by an extension (${error.extension}). ` +
                 'Do you want to disable this extension?',
        noLink: true,
      });
      if (action === 0) {
        // can't access the store at this point because we won't be waiting for the store
        // to be persisted
        fs.writeFileSync(path.join(app.getPath('temp'), '__disable_' + error.extension), '');
      }
    }
  } catch (err) {
    // if the crash occurs before the application is ready, the dialog module can't be
    // used (except for this function)
    dialog.showErrorBox('An unrecoverable error occured',
      error.message + '\n' + error.details +
      '\nIf you think this is a bug, please report it to the ' +
      'issue tracker (github)');
  }

  app.exit(1);
}
