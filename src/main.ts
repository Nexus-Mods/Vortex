/**
 * entry point for the main process
 */

import timeRequire from './util/timeRequire';
const stopTime = timeRequire();

import Application from './app/Application';

import { IError } from './types/IError';
import commandLine from './util/commandLine';
import { sendReport, terminate } from './util/errorHandling';
// ensures tsc includes this dependency
import {} from './util/extensionRequire';
import { log } from './util/log';

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

  process.on('uncaughtException' as any, (error: any) => {
    let details: IError;

    switch (typeof error) {
      case 'object': {
        details = (error.message === undefined) && (error.stack === undefined)
        ? { message: require('util').inspect(error) }
        : { message: error.message, stack: error.stack };
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
