/**
 * entry point for the main process
 */

import 'source-map-support/register';

import timeRequire from './util/timeRequire';
const stopTime = timeRequire();

import { addNotification } from './actions/notifications';
import { setMaximized, setWindowPosition, setWindowSize } from './actions/window';
import { IState, IWindow } from './types/IState';
import commandLine, { IParameters } from './util/commandLine';
import delayed from './util/delayed';
import * as develT from './util/devel';
import { ITermination, sendReport, terminate } from './util/errorHandling';
import ExtensionManagerT from './util/ExtensionManager';
import { log, setupLogging } from './util/log';
import * as storeT from './util/store';
import * as storeHelperT from './util/storeHelper';

import * as Promise from 'bluebird';
import { app, BrowserWindow, crashReporter, Electron, ipcMain, Menu, Tray } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

import extensionRequire from './util/extensionRequire';

stopTime();

extensionRequire();

app.setPath('temp', path.join(app.getPath('userData'), 'temp'));
crashReporter.start({
  productName: 'Vortex',
  companyName: 'Black Tree Gaming Ltd.',
  submitURL: 'https://localhost',
  uploadToServer: false,
});

process.env.Path = process.env.Path + path.delimiter + __dirname;

const basePath: string = app.getPath('userData');
let store: Redux.Store<IState>;
let extensions: ExtensionManagerT;
let loadingScreen: Electron.BrowserWindow;

let mainWindow: Electron.BrowserWindow = null;
let trayIcon: Electron.Tray = null;

// timers used to prevent window resize/move from constantly causeing writes to the
// store
let resizeTimer: NodeJS.Timer;
let moveTimer: NodeJS.Timer;

function createTrayIcon() {
  const imgPath = path.resolve(__dirname, 'assets', 'images',
                      process.platform === 'win32' ? 'vortex.ico' : 'vortex.png');
  trayIcon = new Tray(imgPath);

  trayIcon.setContextMenu(Menu.buildFromTemplate([
    { label: 'Quit', click: () => app.quit() },
  ]));
}

function applyArguments(args: IParameters) {
  if (args.download) {
    mainWindow.webContents.send('external-url', args.download);
  }
}

function showMainWindow() {
  const windowMetrics: IWindow = store.getState().settings.window;
  const { getSafe } = require('./util/storeHelper') as typeof storeHelperT;
  mainWindow.show();

  if (getSafe(windowMetrics, ['maximized'], false)) {
    mainWindow.maximize();
  }

  if (loadingScreen !== undefined) {
    // ensure the splash screen remains visible
    loadingScreen.setAlwaysOnTop(true);

    // don't fade out immediately, otherwise the it looks odd
    // as the main window appears at the same time
    delayed(200)
      .then(() => loadingScreen.webContents.send('fade-out'))
      // wait for the fade out animation to finish before destroying
      // the window
      .then(() => delayed(500))
      .then(() => {
        loadingScreen.close();
        loadingScreen = undefined;
      });
  }
}

ipcMain.on('show-window', showMainWindow);

function createStore(): Promise<void> {
  const { setupStore } = require('./util/store');
  const ExtensionManager = require('./util/ExtensionManager').default;
  extensions = new ExtensionManager();
  return setupStore(basePath, extensions).then((newStore) => {
    store = newStore;
    extensions.doOnce();
    return Promise.resolve();
  });
}

// main window setup

function createWindow(args: IParameters) {
  const { getSafe } = require('./util/storeHelper') as typeof storeHelperT;
  const windowMetrics: IWindow = store.getState().settings.window;
  mainWindow = new BrowserWindow({
    height: getSafe(windowMetrics, ['size', 'height'], undefined),
    width: getSafe(windowMetrics, ['size', 'width'], undefined),
    x: getSafe(windowMetrics, ['position', 'x'], undefined),
    y: getSafe(windowMetrics, ['position', 'y'], undefined),
    autoHideMenuBar: true,
    show: false,
    title: 'Vortex',
  });

  mainWindow.loadURL(`file://${__dirname}/index.html`);
  // mainWindow.loadURL(`file://${__dirname}/index.html?react_perf`);

  // opening the devtools automatically can be very useful if the renderer has
  // trouble loading the page
  // mainWindow.webContents.openDevTools();

  mainWindow.once('ready-to-show', () => {
    extensions.setupApiMain(store, mainWindow.webContents);

    applyArguments(args);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('maximize', () => {
    store.dispatch(setMaximized(true));
  });

  mainWindow.on('unmaximize', () => {
    store.dispatch(setMaximized(false));
  });

  mainWindow.on('resize', () => {
    const size: number[] = mainWindow.getSize();
    if (resizeTimer !== undefined) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
      store.dispatch(setWindowSize({ width: size[0], height: size[1] }));
      resizeTimer = undefined;
    }, 500);
  });

  mainWindow.on('move', (evt) => {
    const pos: number[] = mainWindow.getPosition();
    if (moveTimer !== undefined) {
      clearTimeout(moveTimer);
    }
    moveTimer = setTimeout(() => {
      store.dispatch(setWindowPosition({ x: pos[0], y: pos[1] }));
      moveTimer = undefined;
    }, 500);
  });

  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    event.preventDefault();
    mainWindow.webContents.send('external-url', item.getURL());
    store.dispatch(addNotification({
      type: 'info',
      title: 'Download started',
      message: item.getFilename(),
      displayMS: 4000,
    }));
  });

}

function createLoadingScreen(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    loadingScreen = new BrowserWindow({
      frame: false,
      parent: mainWindow,
      width: 520,
      height: 178,
      transparent: true,
      show: false,
      skipTaskbar: true,
      webPreferences: {
        javascript: false,
        webgl: false,
        backgroundThrottling: false,
        sandbox: false,
      },
    });
    loadingScreen.loadURL(`${__dirname}/splash.html`);
    loadingScreen.once('ready-to-show', () => {
      loadingScreen.show();
      resolve();
    });
  });
}

function setupAppEvents(args: IParameters) {
  app.on('ready', () => {
    createLoadingScreen()
        .then(() => createStore())
        .then(() => {
          createTrayIcon();
          if (process.env.NODE_ENV === 'development') {
            const {installDevelExtensions} =
                require('./util/devel') as typeof develT;
            return installDevelExtensions();
          } else {
            return Promise.resolve();
          }
        })
        .then(() => createWindow(args))
        .catch((err) => {
          terminate({
            message: 'Startup failed',
            details: err.message,
            stack: err.stack,
          });
        });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow(args);
    }
  });
}

function main() {
  const mainArgs = commandLine(process.argv);

  if (mainArgs.report) {
    return sendReport(mainArgs.report)
    .then(() => app.quit());
  }

  const shouldQuit: boolean =
      app.makeSingleInstance((secondaryArgv, workingDirectory) => {
        // this is called inside the primary process with the parameters of
        // the secondary one whenever an additional instance is started
        applyArguments(commandLine(secondaryArgv));
      });

  if (shouldQuit) {
    app.quit();
    process.exit();
  }

  // set up some "global" components
  setupLogging(basePath, process.env.NODE_ENV === 'development');

  log('info', 'logging set up');

  if (process.env.NODE_ENV === 'development') {
    log('info', 'enabling debugging');
    app.commandLine.appendSwitch('remote-debugging-port', '9222');
  }

  // determine where to store settings
  fs.ensureDirSync(basePath);
  log('info', `using ${basePath} as the storage directory`);

  process.on('uncaughtException', (error: any) => {
    let details: ITermination;

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

  setupAppEvents(mainArgs);
}

main();
