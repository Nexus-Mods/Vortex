/**
 * entry point for the main process
 */

import timeRequire from './util/timeRequire';
let stopTime = timeRequire();

import 'source-map-support/register';

import { setMaximized, setWindowPosition, setWindowSize } from './actions/window';
import { IState, IWindow } from './types/IState';
import { installDevelExtensions } from './util/devel';
import { ITermination, terminate } from './util/errorHandling';
import ExtensionManager from './util/ExtensionManager';
import { log, setupLogging } from  './util/log';
import { setupStore } from './util/store';
import { getSafe } from './util/storeHelper';
import { delayed } from './util/util';

import * as Promise from 'bluebird';
import { BrowserWindow, Menu, Tray, app } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

stopTime();

process.env.Path = process.env.Path + path.delimiter + __dirname;

let mainWindow: Electron.BrowserWindow = null;
let trayIcon: Electron.Tray = null;

const urlExp = /([a-z\-]+):\/\/.*/i;

function createTrayIcon() {
  let imgPath = path.resolve(__dirname, 'assets', 'images',
                      process.platform === 'win32' ? 'nmm.ico' : 'nmm.png');
  trayIcon = new Tray(imgPath);

  trayIcon.setContextMenu(Menu.buildFromTemplate([
    { label: 'Quit', click: () => app.quit() },
  ]));
}

const shouldQuit: boolean = app.makeSingleInstance((commandLine, workingDirectory): boolean => {
  // send everything that looks like an url we handle to be opened
  for (let arg of commandLine) {
    let match = arg.match(urlExp);
    if (match !== null) {
      mainWindow.webContents.send('external-url', match[1], arg);
    }
  }

  return true;
});

if (shouldQuit) {
  app.quit();
  process.exit();
}

let basePath: string = app.getPath('userData');
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

process.on('uncaughtException', (error) => {
  let details: ITermination = undefined;

  switch (typeof error) {
    case 'object': {
      details = { message: error.message, details: error.stack };
    } break;
    case 'string': {
      details = { message: error };
    } break;
    default: {
      details = { message: error };
    } break;
  }

  terminate(details);
});

let store: Redux.Store<IState>;
let extensions: ExtensionManager;
let loadingScreen: Electron.BrowserWindow;

function createStore(): Promise<void> {
  // TODO: we load all the extensions here including their dependencies
  //    like ui components despite the fact we only care about the reducers.
  //    If we could fix this that would probably reduce startup time by a
  //    second or more
  extensions = new ExtensionManager();
  return setupStore(basePath, extensions).then((newStore) => {
    store = newStore;
    extensions.doOnce();
    return Promise.resolve();
  });
}

// timers used to prevent window resize/move from constantly causeing writes to the
// store
let resizeTimer: NodeJS.Timer;
let moveTimer: NodeJS.Timer;

// main window setup

function createWindow() {
  let windowMetrics: IWindow = store.getState().settings.window;
  mainWindow = new BrowserWindow({
    height: getSafe(windowMetrics, ['size', 'height'], undefined),
    width: getSafe(windowMetrics, ['size', 'width'], undefined),
    x: getSafe(windowMetrics, ['position', 'x'], undefined),
    y: getSafe(windowMetrics, ['position', 'y'], undefined),
    autoHideMenuBar: true,
    show: false,
    title: 'NMM2',
  });

  mainWindow.loadURL(`file://${__dirname}/index.html`);
  // mainWindow.loadURL(`file://${__dirname}/index.html?react_perf`);

  // opening the devtools automatically can be very useful if the renderer has
  // trouble loading the page
  // mainWindow.webContents.openDevTools();

  mainWindow.once('ready-to-show', () => {
    extensions.setupApiMain(store, mainWindow.webContents);
    mainWindow.show();

    if (getSafe(windowMetrics, ['maximized'], false)) {
      mainWindow.maximize();
    }

    // ensure the splash screen remains visible
    loadingScreen.setAlwaysOnTop(true);

    if (loadingScreen !== undefined) {
      // don't fade out immediately, otherwise the it looks odd
      // as the main window appears at the same time
      delayed(200)
      .then(() => loadingScreen.webContents.send('fade-out'))
      // wait for the fade out animation to finish before destroying
      // the window
      .then(() => delayed(500))
      .then(() => loadingScreen.destroy());
    }
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
    let size: number[] = mainWindow.getSize();
    if (resizeTimer !== undefined) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
      store.dispatch(setWindowSize({ width: size[0], height: size[1] }));
      resizeTimer = undefined;
    }, 500);
  });

  mainWindow.on('move', (evt) => {
    let pos: number[] = mainWindow.getPosition();
    if (moveTimer !== undefined) {
      clearTimeout(moveTimer);
    }
    moveTimer = setTimeout(() => {
      store.dispatch(setWindowPosition({ x: pos[0], y: pos[1] }));
      moveTimer = undefined;
    }, 500);
  });
}

function createLoadingScreen(): Promise<undefined> {
  return new Promise<undefined>((resolve, reject) => {
  // TODO: we can't use the mainWindow as the parent here because it's not created yet.
  //       this makes the main window hide the splash screen as soon as it shows up.
  //       we can't create it yet because stuff isn't loaded yet. Maybe if we could create
  //       the main window in an "empty" mode where it doesn't try to load extensions&access
  //       the store...
  loadingScreen = new BrowserWindow({
    frame: false, parent: mainWindow, width: 520, height: 178, transparent: true, show: false,
    skipTaskbar: true, javascript: false, webgl: false, backgroundThrottling: false, sandbox: false,
  } as any);
  loadingScreen.loadURL(`${__dirname}/splash.html`);
  loadingScreen.once('ready-to-show', () => {
    loadingScreen.show();
    resolve();
  });
  });
}

app.on('ready', () => {
  createLoadingScreen()
  // TODO horrible hack! This delays all loading by 200 ms but if we don't the splash screen
  //   doesn't become visible until _after_ most of the initialization happened (loading the
  //   the store and extensions)
  .then(() => delayed(200))
  .then(() => createStore())
  .then(() => {
    createTrayIcon();
    return installDevelExtensions();
  })
  .then(() => {
    createWindow();
  })
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
    createWindow();
  }
});
