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

import { BrowserWindow, app } from 'electron';
import * as fs from 'fs-extra-promise';

import doRestart = require('electron-squirrel-startup');

if (doRestart) {
  app.quit();
}

installDevelExtensions();

// determine where to store settings
let basePath: string = app.getPath('userData');
fs.ensureDirSync(basePath);
log('info', `using ${basePath} as the storage directory`);

// set up some "global" components
setupLogging(basePath, process.env.NODE_ENV === 'development');

const extensions: ExtensionManager = new ExtensionManager();
const store: Redux.Store<IState> = setupStore(basePath, extensions);

// main window setup

let mainWindow: Electron.BrowserWindow = null;

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

const shouldQuit: boolean = app.makeSingleInstance((commandLine, workingDirectory): boolean => {
  // This is a second instance, instead of starting a new one, bring the existing one to front
  if (mainWindow !== null) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
  return true;
});

if (shouldQuit) {
  app.quit();
}

app.on('ready', () => {
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
