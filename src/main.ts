/**
 * entry point for the main process
 */

import './util/application.electron';
import getVortexPath from './util/getVortexPath';
import { isWindows, isMacOS } from './util/platform';
import { setupMacOSPaths } from './util/macosPaths';

import { app, dialog, Menu, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';

const earlyErrHandler = (error) => {
  if (error.stack.includes('[as dlopen]')) {
    dialog.showErrorBox(
      'Vortex failed to start up',
      `An unexpected error occurred while Vortex was initialising:\n\n${error.message}\n\n`

      + 'This is often caused by a bad installation of the app, '
      + 'a security app interfering with Vortex '
      + 'or a problem with the Microsoft Visual C++ Redistributable installed on your PC. '
      + 'To solve this issue please try the following:\n\n'

      + '- Wait a moment and try starting Vortex again\n'
      + '- Reinstall Vortex from the Nexus Mods website\n'
      + '- Install the latest Microsoft Visual C++ Redistributable (find it using a search engine)\n'
      + '- Disable anti-virus or other security apps that might interfere and install Vortex again\n\n'

      + 'If the issue persists, please create a thread in our support forum for further assistance.');
  } else {
    dialog.showErrorBox('Unhandled error',
                        'Vortex failed to start up. This is usually caused by foreign software (e.g. Anti Virus) '
      + 'interfering.\n\n' + error.stack);
  }
  app.exit(1);
};

process.on('uncaughtException', earlyErrHandler);
process.on('unhandledRejection', earlyErrHandler);

// ensure the cwd is always set to the path containing the exe, otherwise dynamically loaded
// dlls will not be able to load vc-runtime files shipped with Vortex.
// Setup macOS-specific paths before anything else
if (isMacOS()) {
  setupMacOSPaths();
}

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

function setEnv(key: string, value: string, force?: boolean) {
  if ((process.env[key] === undefined) || force) {
    process.env[key] = value;
  }
}

if (process.env.NODE_ENV !== 'development') {
  setEnv('NODE_ENV', 'production', true);
} else {
  // tslint:disable-next-line:no-var-requires
  const rebuildRequire = require('./util/requireRebuild').default;
  rebuildRequire();
}

if (isWindows() && (process.env.NODE_ENV !== 'development')) {
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
  process.env['PATH'] = process.env['PATH'].split(path.delimiter)
    .filter(pathFilter).join(path.delimiter);
} else if (isMacOS() && (process.env.NODE_ENV !== 'development')) {
  // On macOS, we may want to filter certain paths for security reasons
  // This is less critical than on Windows but still good practice
  const pathFilter = (envPath: string): boolean => {
    // Filter out potentially unsafe paths on macOS
    return !envPath.includes('/tmp/') 
        && !envPath.startsWith('/var/tmp/')
        && !envPath.includes('/.Trash/');
  };

  process.env['PATH_ORIG'] = process.env['PATH'].slice(0);
  process.env['PATH'] = process.env['PATH'].split(path.delimiter)
    .filter(pathFilter).join(path.delimiter);
}

// Produce english error messages (windows only atm), otherwise they don't get
// grouped correctly when reported through our feedback system
if (isWindows()) {
  try {
    // tslint:disable-next-line:no-var-requires
    const winapi = isWindows() ? (isWindows() ? require('winapi-bindings') : undefined) : undefined;
    winapi?.SetProcessPreferredUILanguages?.(['en-US']);
  } catch (err) {
    // nop
  }
}

import {} from './util/requireRebuild';

import Application from './app/Application';

import type { IPresetStep, IPresetStepCommandLine } from './types/IPreset';

import commandLine, { relaunch } from './util/commandLine';
import { sendReportFile, terminate, toError } from './util/errorHandling';
// ensures tsc includes this dependency
import {} from './util/extensionRequire';

// required for the side-effect!
import './util/exeIcon';
import './util/monkeyPatching';
import './util/webview';

import * as child_processT from 'child_process';
import * as fs from './util/fs';
import presetManager from './util/PresetManager';

process.env.Path = process.env.Path + path.delimiter + __dirname;

let application: Application;

const handleError = (error: any) => {
  if (Application.shouldIgnoreError(error)) {
    return;
  }

  terminate(toError(error), {});
};

async function firstTimeInit() {
  // use this to do first time setup, that is: code to be run
  // only the very first time vortex starts up.
  // This functionality was introduced but then we ended up solving
  // the problem in a different way that's why this is unused currently
}

async function main(): Promise<void> {
  // important: The following has to be synchronous!
  const mainArgs = commandLine(process.argv, false);
  if (mainArgs.report) {
    return sendReportFile(mainArgs.report)
      .then(() => {
        app.quit();
      });
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

  app.commandLine.appendSwitch('disable-features', 'WidgetLayering');
  app.commandLine.appendSwitch('disable-features', 'UseEcoQoSForBackgroundProcess');

  if (isMacOS()) {
    const template: MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ]
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  // --run has to be evaluated *before* we request the single instance lock!
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

  if (!app.requestSingleInstanceLock()) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('--in-process-gpu');
    app.commandLine.appendSwitch('--disable-software-rasterizer');
    app.quit();
    return;
  }

  // async code only allowed from here on out

  if (!presetManager.now('commandline', (step: IPresetStep): Promise<void> => {
    (step as IPresetStepCommandLine).arguments.forEach(arg => {
      mainArgs[arg.key] = arg.value ?? true;
    });
    return Promise.resolve();
  })) {
    // if the first step was not a command-line instruction but we encounter one
    // further down the preset queue, Vortex has to restart to process it.
    // this is only relevant for the main process, if the renderer process encounters
    // this it will have its own handler and can warn the user the restart is coming
    presetManager.on('commandline', (): Promise<void> => {
      // return a promise that doesn't finish
      relaunch();
      return new Promise(() => {
        // nop
      });
    });
  }

  try {
    await fs.statAsync(getVortexPath('userData'));
  } catch (err) {
    await firstTimeInit();
  }

  process.on('uncaughtException', handleError);
  process.on('unhandledRejection', handleError);

  if ((process.env.NODE_ENV === 'development')
      && (!app.commandLine.hasSwitch('remote-debugging-port'))) {
    app.commandLine.appendSwitch('remote-debugging-port', DEBUG_PORT);
  }

  // tslint:disable-next-line:no-submodule-imports
  require('@electron/remote/main').initialize();

  let fixedT = require('i18next').getFixedT('en');
  try {
    fixedT('dummy');
  } catch (err) {
    fixedT = input => input;
  }

  /* allow application controlled scaling
  if (isWindows()) {
    app.commandLine.appendSwitch('high-dpi-support', 'true');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
  }
  */
  application = new Application(mainArgs);
}

main();
