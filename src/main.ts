/**
 * entry point for the main process
 */

import 'source-map-support/register';

import { setMaximized, setWindowPosition, setWindowSize } from './actions/window';
import { IState, IWindow } from './types/IState';
import { installDevelExtensions } from './util/devel';
import ExtensionManager from './util/ExtensionManager';
import { log, setupLogging } from  './util/log';
import { setupStore } from './util/store';

import { BrowserWindow, Menu, Tray, app } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

import doRestart = require('electron-squirrel-startup');

if (doRestart) {
  app.quit();
}

let mainWindow: Electron.BrowserWindow = null;
let trayIcon: Electron.Tray = null;

const urlExp = /([a-z\-]+):\/\/.*/i;

function createTrayIcon() {
  trayIcon = new Tray(path.resolve(__dirname, 'assets', 'images', 'nmm.ico'));

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
}

if (process.env.NODE_ENV === 'development') {
  log('info', 'enabling debugging');
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

// determine where to store settings
let basePath: string = app.getPath('userData');
fs.ensureDirSync(basePath);
log('info', `using ${basePath} as the storage directory`);

// set up some "global" components
setupLogging(basePath, process.env.NODE_ENV === 'development');

// TODO: we load all the extensions here including their dependencies
//    like ui components despite the fact we only care about the reducers.
//    If we could fix this that would probably reduce startup time by a
//    second or more
const extensions: ExtensionManager = new ExtensionManager();
const store: Redux.Store<IState> = setupStore(basePath, extensions);

// main window setup

function createWindow() {
  let windowMetrics: IWindow = store.getState().window.base;
  mainWindow = new BrowserWindow({
    height: windowMetrics.size.height,
    width: windowMetrics.size.width,
    x: windowMetrics.position.x,
    y: windowMetrics.position.y,
    autoHideMenuBar: true,
    show: false,
    title: 'NMM2',
  });

  if (windowMetrics.maximized) {
    mainWindow.maximize();
  }

  mainWindow.loadURL(`file://${__dirname}/index.html`);
  // opening the devtools automatically can be very useful if the renderer has
  // trouble loading the page
  // mainWindow.webContents.openDevTools();

  mainWindow.once('ready-to-show', () => {
    log('info', 'ready to show');
    mainWindow.show();
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
    store.dispatch(setWindowSize({ width: size[0], height: size[1] }));
  });

  mainWindow.on('move', (evt) => {
    let pos: number[] = mainWindow.getPosition();
    store.dispatch(setWindowPosition({ x: pos[0], y: pos[1] }));
  });
}

app.on('ready', () => {
  createTrayIcon();
  installDevelExtensions().then(createWindow);
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
