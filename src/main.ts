/**
 * entry point for the main process
 */

import * as sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import requireRemap from './util/requireRemap';
requireRemap();

if (process.env.NODE_ENV !== 'development') {
  // see renderer.ts for why this is so ugly
  const key = 'NODE_ENV';
  process.env[key] = 'production';
} else {
  // tslint:disable-next-line:no-var-requires
  const rebuildRequire = require('./util/requireRebuild').default;
  rebuildRequire();
}

// Produce english error messages (windows only atm), otherwise they don't get
// grouped correctly when reported through our feedback system
import { SetProcessPreferredUILanguages } from 'winapi-bindings';
if (SetProcessPreferredUILanguages !== undefined) {
  SetProcessPreferredUILanguages(['en-US']);
}

import {} from './util/requireRebuild';

import Application from './app/Application';

import './util/monkeyPatching';
import commandLine from './util/commandLine';
import { UserCanceled } from './util/CustomErrors';
import { sendReportFile, terminate, toError } from './util/errorHandling';
// ensures tsc includes this dependency
import {} from './util/extensionRequire';
import { truthy } from './util/util';

import * as child_processT from 'child_process';
import { app, dialog } from 'electron';
import * as path from 'path';

process.env.Path = process.env.Path + path.delimiter + __dirname;

let application: Application;

const handleError = (error: any) => {
  if (error instanceof UserCanceled) {
    return;
  }

  if (!truthy(error)) {
    return;
  }

  if (['net::ERR_CONNECTION_RESET',
       'net::ERR_ABORTED',
       'net::ERR_CONTENT_LENGTH_MISMATCH',
       'net::ERR_INCOMPLETE_CHUNKED_ENCODING'].indexOf(error.message) !== -1) {
    return;
  }

  terminate(toError(error), {});
};

function main() {
  const mainArgs = commandLine(process.argv);
  if (mainArgs.report) {
    return sendReportFile(mainArgs.report)
    .then(() => {
      app.quit();
    });
  }

  let fixedT = require('i18next').getFixedT('en');
  try {
    fixedT('dummy');
  } catch (err) {
    fixedT = input => input;
  }

  if (mainArgs.run !== undefined) {
    // Vortex here acts only as a trampoline (probably elevated) to start
    // some other process
    const cp: typeof child_processT = require('child_process');
    cp.spawn(process.execPath, [ mainArgs.run ], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: 'inherit',
      detached: true,
    })
    .on('error', err => {
      // TODO: In practice we have practically no information about what we're running
      //       at this point
      dialog.showErrorBox('Failed to run script', err.message);
    });
    // quit this process, the new one is detached
    app.quit();
    return;
  }

  process.on('uncaughtException', handleError);
  process.on('unhandledRejection', handleError);

  application = new Application(mainArgs);

  if (process.env.NODE_ENV === 'development') {
    app.commandLine.appendSwitch('remote-debugging-port', '9222');
  }

  /* allow application controlled scaling
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('high-dpi-support', 'true');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
  }
  */
}

main();
