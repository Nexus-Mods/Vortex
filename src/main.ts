/**
 * entry point for the main process
 */

import 'source-map-support/register';

import timeRequire from './util/timeRequire';
const stopTime = timeRequire();

import Application from './app/Application';

import { IError } from './types/IError';
import commandLine from './util/commandLine';
import { sendReport, terminate } from './util/errorHandling';
// ensures tsc includes this dependency
import {} from './util/extensionRequire';
import { log, setupLogging } from './util/log';

import { app, crashReporter } from 'electron';
import * as path from 'path';

stopTime();

crashReporter.start({
  productName: 'Vortex',
  companyName: 'Black Tree Gaming Ltd.',
  submitURL: 'https://localhost',
  uploadToServer: false,
});

process.env.Path = process.env.Path + path.delimiter + __dirname;

let application: Application;

function main() {
  const mainArgs = commandLine(process.argv);

  if (mainArgs.report) {
    return sendReport(mainArgs.report)
    .then(() => app.quit());
  }

  setupLogging(app.getPath('userData'), process.env.NODE_ENV === 'development');

  application = new Application(mainArgs);

  log('info', 'logging set up');

  if (process.env.NODE_ENV === 'development') {
    log('info', 'enabling debugging');
    app.commandLine.appendSwitch('remote-debugging-port', '9222');
  }

  process.on('uncaughtException' as any, (error: any) => {
    let details: IError;

    switch (typeof error) {
      case 'object': {
        details = {message: error.message, details: error.stack};
      }              break;
      case 'string': {
        details = {message: error as string};
      }              break;
      default: { details = {message: error}; } break;
    }

    terminate(details);
  });
}

main();
