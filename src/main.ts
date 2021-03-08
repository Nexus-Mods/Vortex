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

if ((process.platform === 'win32') && (process.env.NODE_ENV !== 'development')) {
  // On windows dlls may be loaded from directories in the path variable
  // (which I don't know why you'd ever want that) so I filter path quite aggressively here
  // to prevent dynamically loaded dlls to be loaded from unexpected locations.
  // The most common problem this should prevent is the edge dll being loaded from
  // "Browser Assistant" instead of our own.

  const userPath = (process.env.HOMEDRIVE || 'c:') + (process.env.HOMEPATH || '\\Users');
  const programFiles = process.env.ProgramFiles ||  'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const programData = process.env.ProgramData || 'C:\\ProgramData';

  const pathFilter = (envPath: string): boolean => {
    return !envPath.startsWith(userPath)
        && !envPath.startsWith(programData)
        && !envPath.startsWith(programFiles)
        && !envPath.startsWith(programFilesX86);
  };

  process.env['PATH_ORIG'] = process.env['PATH'].slice(0);
  process.env['PATH'] = process.env['PATH'].split(';')
    .filter(pathFilter).join(';');
}

// Produce english error messages (windows only atm), otherwise they don't get
// grouped correctly when reported through our feedback system
import { SetProcessPreferredUILanguages } from 'winapi-bindings';
if (SetProcessPreferredUILanguages !== undefined) {
  SetProcessPreferredUILanguages(['en-US']);
}

import {} from './util/requireRebuild';

import Application from './app/Application';

import commandLine from './util/commandLine';
import { UserCanceled } from './util/CustomErrors';
import { sendReportFile, terminate, toError } from './util/errorHandling';
// ensures tsc includes this dependency
import {} from './util/extensionRequire';
import './util/monkeyPatching';
import { truthy } from './util/util';

import Promise from 'bluebird';
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
       'net::ERR_CONNECTION_ABORTED',
       'net::ERR_ABORTED',
       'net::ERR_CONTENT_LENGTH_MISMATCH',
       'net::ERR_SSL_PROTOCOL_ERROR',
       'net::ERR_HTTP2_PROTOCOL_ERROR',
       'net::ERR_INCOMPLETE_CHUNKED_ENCODING'].includes(error.message)) {
    return;
  }

  // this error message appears to happen as the result of some other problem crashing the
  // renderer process, so all this may do is obfuscate what's actually going on.
  if (error.message.includes('Error processing argument at index 0, conversion failure from')) {
    return;
  }

  terminate(toError(error), {});
};

function main() {
  app.allowRendererProcessReuse = false;

  const mainArgs = commandLine(process.argv, false);
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

  if (mainArgs.disableGPU) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('--disable-software-rasterizer');
    app.commandLine.appendSwitch('--disable-gpu');
  }

  process.on('uncaughtException', handleError);
  process.on('unhandledRejection', handleError);

  if (process.env.NODE_ENV === 'development') {
    app.commandLine.appendSwitch('remote-debugging-port', '9222');
  }

  /* allow application controlled scaling
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('high-dpi-support', 'true');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
  }
  */
  application = new Application(mainArgs);
}

main();
