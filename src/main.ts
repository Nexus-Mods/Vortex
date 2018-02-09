/**
 * entry point for the main process
 */

if (process.env.NODE_ENV === 'development') {
  // tslint:disable-next-line:no-var-requires
  const rebuildRequire = require('./util/requireRebuild').default;
  rebuildRequire();
}

import timeRequire from './util/timeRequire';
const stopTime = timeRequire();

import Application from './app/Application';

import { IError } from './types/IError';
import commandLine from './util/commandLine';
import { sendReport, terminate } from './util/errorHandling';
// ensures tsc includes this dependency
import {} from './util/extensionRequire';
import { log } from './util/log';

import { app, crashReporter, dialog } from 'electron';
import * as path from 'path';

stopTime();

/*
crashReporter.start({
  productName: 'Vortex',
  companyName: 'Black Tree Gaming Ltd.',
  submitURL: 'https://localhost',
  uploadToServer: false,
});
*/

process.env.Path = process.env.Path + path.delimiter + __dirname;

let application: Application;

const handleError = (error: any) => {
  let details: IError;

  switch (typeof error) {
    case 'object': {
      details = (error.message === undefined) && (error.stack === undefined) ?
                    {message: require('util').inspect(error)} :
                    {message: error.message, stack: error.stack};
                 } break;
    case 'string': {
      details = {message: error as string};
                 } break;
    default: {
      details = {message: error};
           } break;
  }

  terminate(details);
};

function main() {
  const mainArgs = commandLine(process.argv);

  if (mainArgs.report) {
    return sendReport(mainArgs.report)
    .then(() => app.quit());
  }

  if (mainArgs.run !== undefined) {
    // Vortex here acts only as a trampoline (probably elevated) to start
    // some other process
    const { spawn } = require('child_process');
    spawn(process.execPath, [ mainArgs.run ], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      detached: true,
    })
    .on('error', err => {
      // TODO: In practice we have practically no information about what we're running
      //       at this point
      dialog.showErrorBox('Failed to run script', err.message);
    });
    app.quit();
    return;
  }

  application = new Application(mainArgs);

  if (process.env.NODE_ENV === 'development') {
    log('info', 'enabling debugging');
    app.commandLine.appendSwitch('remote-debugging-port', '9222');
  }

  /* allow application controlled scaling
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('high-dpi-support', 'true');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
  }
  */

  process.on('uncaughtException', handleError);
  process.on('unhandledRejection', handleError);
}

main();
