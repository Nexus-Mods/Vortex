/**
 * entry point for the main process
 */

import './util/application.electron';
import getVortexPath from './util/getVortexPath';

import { app, dialog } from 'electron';
import * as path from 'path';

// ensure the cwd is always set to the path containing the exe, otherwise dynamically loaded
// dlls will not be able to load vc-runtime files shipped with Vortex.
process.chdir(getVortexPath('application'));

/* the below would completely restart Vortex to ensure everything is loaded with the cwd
   reset but that doesn't seem to be necessary
// if this is the primary instance, verify we run from the right cwd, otherwise
// vc runtime files might not load correctly
if (!process.argv.includes('--relaunched')
  && (path.normalize(process.cwd()).toLowerCase()
    !== path.normalize(getVortexPath('application')).toLowerCase())) {
  // tslint:disable-next-line:no-var-requires
  const cp: typeof child_processT = require('child_process');
  const args = [].concat(['--relaunched'], process.argv.slice(1));
  const proc = cp.spawn(process.execPath, args, {
    cwd: getVortexPath('application'),
    detached: true,
  });
  app.quit();
}
*/

import { DEBUG_PORT, HTTP_HEADER_SIZE } from './constants';

import * as sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import requireRemap from './util/requireRemap';
requireRemap();

function setEnv(key: string, value: string) {
  process.env[key] = value;
}

if (process.env.NODE_ENV !== 'development') {
  setEnv('NODE_ENV', 'production');
} else {
  // tslint:disable-next-line:no-var-requires
  const rebuildRequire = require('./util/requireRebuild').default;
  rebuildRequire();
}

{
  setEnv('NEXUS_NEXT_URL', 'https://next.nexusmods.com');
  // setEnv('IGNORE_UPDATES', 'yes');
  setEnv('FORCE_UPDATE_CHANNEL', 'next');
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
// required for the side-effect!
import './util/webview';

import * as child_processT from 'child_process';

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
  const mainArgs = commandLine(process.argv, false);
  if (mainArgs.report) {
    return sendReportFile(mainArgs.report)
    .then(() => {
      app.quit();
    });
  }

  // tslint:disable-next-line:no-submodule-imports
  require('@electron/remote/main').initialize();

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

  const NODE_OPTIONS = process.env.NODE_OPTIONS || '';
  process.env.NODE_OPTIONS = NODE_OPTIONS
    + ` --max-http-header-size=${HTTP_HEADER_SIZE}`
    + ' --no-force-async-hooks-checks';

  if (mainArgs.disableGPU) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('--disable-software-rasterizer');
    app.commandLine.appendSwitch('--disable-gpu');
  }

  process.on('uncaughtException', handleError);
  process.on('unhandledRejection', handleError);

  if (process.env.NODE_ENV === 'development') {
    app.commandLine.appendSwitch('remote-debugging-port', DEBUG_PORT);
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
