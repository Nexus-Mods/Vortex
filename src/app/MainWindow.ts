import {addNotification} from '../actions/notifications';
import {setMaximized, setWindowPosition,  setWindowSize} from '../actions/window';
import { ThunkStore } from '../types/IExtensionContext';
import {IState, IWindow} from '../types/IState';
import Debouncer from '../util/Debouncer';
import { terminate } from '../util/errorHandling';
import getVortexPath from '../util/getVortexPath';
import { log } from '../util/log';
import opn from '../util/opn';
import { downloadPath } from '../util/selectors';
import * as storeHelperT from '../util/storeHelper';
import { parseBool, truthy } from '../util/util';
import { closeAllViews } from '../util/webview';

import Promise from 'bluebird';
import { ipcMain, screen, webContents } from 'electron';
import * as path from 'path';
import * as Redux from 'redux';
import { pathToFileURL } from 'url';
import TrayIcon from './TrayIcon';

const MIN_HEIGHT = 700;
const REQUEST_HEADER_FILTER = {
  urls: ['*://enbdev.com/*'],
};

interface IRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function bounds2rect(bounds): IRect {
  return {
    x1: bounds.x,
    y1: bounds.y,
    x2: bounds.x + bounds.width,
    y2: bounds.y + bounds.height,
  };
}

function intersect(lhs: IRect, rhs: IRect): IRect {
  const res = {
    x1: Math.max(lhs.x1, rhs.x1),
    y1: Math.max(lhs.y1, rhs.y1),
    x2: Math.min(lhs.x2, rhs.x2),
    y2: Math.min(lhs.y2, rhs.y2),
  };

  if ((res.x1 > res.x2) || (res.y1 > res.y2)) {
    res.x1 = res.x2 = res.y1 = res.y2 = 0;
  }
  return res;
}

function reactArea(input: IRect): number {
  return (input.x2 - input.x1) * (input.y2 - input.y1);
}

class MainWindow {
  private mWindow: Electron.BrowserWindow = null;
  // timers used to prevent window resize/move from constantly causeing writes to the
  // store
  private mResizeDebouncer: Debouncer;
  private mMoveDebouncer: Debouncer;
  private mShown: boolean;
  private mInspector: boolean;
  private mStore: Redux.Store<IState>;

  constructor(store: Redux.Store<IState>, inspector: boolean) {
    this.mStore = store;
    this.mInspector = inspector === true;
    this.mResizeDebouncer = new Debouncer(() => {
      if ((this.mWindow !== null) && !this.mWindow.isMaximized()) {
        const size: number[] = this.mWindow.getSize();
        store.dispatch(setWindowSize({width: size[0], height: size[1]}));
      }
      return null;
    }, 500);

    this.mMoveDebouncer = new Debouncer((x: number, y: number) => {
      if ((this.mWindow !== null)) {
        store.dispatch(setWindowPosition({x, y}));
        return null;
      }
      return null;
    }, 500);
  }

  public create(store: ThunkStore<IState>): Promise<Electron.WebContents> {
    if (this.mWindow !== null) {
      return Promise.resolve(undefined);
    }

    const BrowserWindow: typeof Electron.BrowserWindow = require('electron').BrowserWindow;

    this.mWindow = new BrowserWindow(this.getWindowSettings(store.getState().settings.window));

    this.mWindow.loadURL(pathToFileURL(path.join(getVortexPath('base'), 'index.html')).href);
    // this.mWindow.loadURL(`file://${getVortexPath('base')}/index.html?react_perf`);

    let cancelTimer: NodeJS.Timeout;

    // opening the devtools automatically can be very useful if the renderer has
    // trouble loading the page
    if (this.mInspector || parseBool(process.env.START_DEVTOOLS)) {
      // You can set START_DEVTOOLS to true, by creating a .env file in the root of the project
      this.mWindow.webContents.openDevTools();
    }
    this.mWindow.webContents.on('console-message',
      (evt: Electron.Event, level: number, message: string) => {
        if (level !== 2) {
          // TODO: at the time of writing (electron 2.0.3) this event doesn't seem to
          //   provide the other parameters of the message.
          //   That is actually a known issue in chrome but the chrome people don't seem to care too
          //   much and wait for a PR by the electron people but those have closed the issue. fun
          log('info', message);
        } else if (cancelTimer === undefined) {
          // if an error is logged by the renderer and the window isn't shown within a reasonable
          // time, it was probably something terminal.
          // this isn't ideal as we don't have a stack trace of the error message here
          cancelTimer = setTimeout(() => {
            if (!this.mShown) {
              terminate({ message: 'Vortex failed to start', details: message },
                        {}, true, 'renderer');
            }
          }, 15000);
        }
      });

    this.mWindow.webContents.on('render-process-gone',
        (evt, details: Electron.RenderProcessGoneDetails) => {
      log('error', 'render process gone', { exitCode: details.exitCode, reason: details.reason });
      if (details.reason !== 'killed') {
        store.dispatch(addNotification({
          type: 'error',
          message: 'Vortex restarted after a crash, sorry about that.',
        }));
        // workaround for electron issue #19887
        setImmediate(() => {
          process.env.CRASH_REPORTING = (Math.random() > 0.5) ? 'vortex' : 'electron';
          if (this.mWindow !== null) {
            this.mWindow.loadURL(`file://${getVortexPath('base')}/index.html`);
          } else {
            process.exit();
          }
        });
      }
    });

    this.mWindow.webContents.on('did-fail-load', (evt, code, description, url) => {
      log('error', 'failed to load page', { code, description, url });
    });

    const signalUrl = (item: Electron.DownloadItem) => {
      if (truthy(this.mWindow) && !this.mWindow.isDestroyed()) {
        try {
          this.mWindow.webContents.send('received-url', item.getURL(), item.getFilename());
        } catch (err) {
          log('warn', 'starting download failed', err.message);
        }
      }
    };

    this.mWindow.webContents.session.webRequest.onBeforeSendHeaders(REQUEST_HEADER_FILTER, (details, callback) => {
      details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36';
      callback({ requestHeaders: details.requestHeaders });
    });

    this.mWindow.webContents.session.on('will-download', (event, item) => {
      // unfortunately we have to deal with these events in the main process even though
      // we'll do the work in the renderer
      if (item.getURL().startsWith('blob:')) {
        const dlPath = downloadPath(this.mStore.getState());
        item.setSavePath(path.join(dlPath, item.getFilename() + '.tmp'));
        item.once('done', () => {
          signalUrl(item);
        });
      } else {
        event.preventDefault();
        signalUrl(item);
      }
    });

    this.mWindow.webContents.setWindowOpenHandler((details) => {
      if (details.disposition === 'background-tab') {
        return { action: 'deny' };
      }
    });

    this.mWindow.webContents.on('will-navigate', (event, url) => {
      log('debug', 'navigating to page', url);
      opn(url).catch(() => null);
      event.preventDefault();
    });

    this.initEventHandlers(store);

    return new Promise<Electron.WebContents>((resolve) => {
      this.mWindow.once('ready-to-show', () => {
        if ((resolve !== undefined) && (this.mWindow !== null)) {
          resolve(this.mWindow.webContents);
          resolve = undefined;
        }
      });
      // if the show-window event is triggered before ready-to-show,
      // that event never gets triggered so we'd be stuck
      ipcMain.on('show-window', () => {
        if ((resolve !== undefined) && (this.mWindow !== null)) {
          resolve(this.mWindow.webContents);
          resolve = undefined;
        }
      });
      ipcMain.on('webview-dom-ready', (evt, id) => {
        const contents = webContents.fromId(id);
        contents.setWindowOpenHandler(({ url, disposition }) => {
          evt.sender.send('webview-open-url', id, url, disposition);
          return { action: 'deny' };
        });
      });
    });
  }

  public connectToTray(tray: TrayIcon) {
    tray.setMainWindow(this.mWindow);
  }

  public show(maximized: boolean, startMinimized: boolean) {
    this.mShown = true;
    if (truthy(this.mWindow)) {
      this.mWindow.show();
      if (maximized) {
        this.mWindow.maximize();
      }

      if (startMinimized === true) {
        // Technically the window could be displayed for a split second
        //  before we manage to hide it but then the only alternative would
        //  be to pass this function as a functor to the tray so it can
        //  run the bounds check and maximize (if needed) on its own.
        //  (which we may have to do if people start complaining about
        //  flickering - cross that bridge when we get to it)
        this.mWindow.hide();
      }

      let overlap = 0;
      const bounds = this.mWindow.getBounds();
      const winRect = bounds2rect(bounds);
      screen.getAllDisplays().forEach(display => {
        const displayRect = bounds2rect(display.bounds);
        overlap += reactArea(intersect(winRect, displayRect));
      });

      const visible = overlap / reactArea(winRect);
      if (visible < 0.25) {
        const pBounds = screen.getPrimaryDisplay().bounds;
        log('warn', 'The Vortex window was found to be mostly offscreen. '
                  + 'Moving to a sensible location.', { bounds });
        this.mWindow.setPosition(pBounds.x, pBounds.y);
      }
    }
  }

  public sendExternalURL(url: string, install: boolean) {
    if (this.mWindow !== null) {
      try {
        this.mWindow.webContents.send('external-url', url, undefined, install);
      } catch (err) {
        log('error', 'failed to send external url', { url, error: err.message });
      }
    }
  }

  public getHandle(): Electron.BrowserWindow {
    return this.mWindow;
  }

  private getWindowSettings(windowMetrics: IWindow): Electron.BrowserWindowConstructorOptions {
    const {getSafe} = require('../util/storeHelper') as typeof storeHelperT;
    const screenArea = screen.getPrimaryDisplay().workAreaSize;
    const width = Math.max(1024, getSafe(windowMetrics, ['size', 'width'],
                                         Math.floor(screenArea.width * 0.8)));
    const height = Math.max(MIN_HEIGHT, getSafe(windowMetrics, ['size', 'height'],
                                                Math.floor(screenArea.height * 0.8)));
    return {
      width,
      height,
      minWidth: 1024,
      minHeight: MIN_HEIGHT,
      x: getSafe(windowMetrics, ['position', 'x'], undefined),
      y: getSafe(windowMetrics, ['position', 'y'], undefined),
      backgroundColor: '#fff',
      autoHideMenuBar: true,
      frame: !getSafe(windowMetrics, ['customTitlebar'], true),
      show: false,
      title: 'Vortex',
      titleBarStyle: windowMetrics?.customTitlebar === true ? 'hidden' : 'default',
      webPreferences: {
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        webviewTag: true,
        enableWebSQL: false,
        contextIsolation: false,
        backgroundThrottling: false,
      },
    };
  }

  private initEventHandlers(store: Redux.Store<IState>) {
    this.mWindow.on('close', () => {
      closeAllViews(this.mWindow);
    });
    this.mWindow.on('closed', () => { this.mWindow = null; });
    this.mWindow.on('maximize', () => store.dispatch(setMaximized(true)));
    this.mWindow.on('unmaximize', () => store.dispatch(setMaximized(false)));
    this.mWindow.on('resize', () => this.mResizeDebouncer.schedule());
    this.mWindow.on('move', () => {
      if (this.mWindow?.isMaximized?.() === false) {
        const pos: number[] = this.mWindow.getPosition();
        this.mMoveDebouncer.schedule(undefined, pos[0], pos[1]);
      }
    });
  }
}

export default MainWindow;
