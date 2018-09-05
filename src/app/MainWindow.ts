import {addNotification} from '../actions/notifications';
import {setMaximized, setWindowPosition,  setWindowSize} from '../actions/window';
import {IState, IWindow} from '../types/IState';
import Debouncer from '../util/Debouncer';
import { terminate } from '../util/errorHandling';
import getVortexPath from '../util/getVortexPath';
import { log } from '../util/log';
import * as storeHelperT from '../util/storeHelper';

import * as Promise from 'bluebird';
import { screen } from 'electron';
import * as Redux from 'redux';
import TrayIcon from './TrayIcon';
import { ThunkStore } from '../types/IExtensionContext';

class MainWindow {
  private mWindow: Electron.BrowserWindow = null;
  // timers used to prevent window resize/move from constantly causeing writes to the
  // store
  private mResizeDebouncer: Debouncer;
  private mMoveDebouncer: Debouncer;
  private mShown: boolean;

  constructor(store: Redux.Store<IState>) {
    this.mResizeDebouncer = new Debouncer(() => {
      if ((this.mWindow !== null) && !this.mWindow.isMaximized()) {
        const size: number[] = this.mWindow.getSize();
        store.dispatch(setWindowSize({width: size[0], height: size[1]}));
      }
      return null;
    }, 500);

    this.mMoveDebouncer = new Debouncer(() => {
      if ((this.mWindow !== null) && !this.mWindow.isMaximized()) {
        const pos: number[] = this.mWindow.getPosition();
        store.dispatch(setWindowPosition({x: pos[0], y: pos[1]}));
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

    this.mWindow.loadURL(`file://${getVortexPath('base')}/index.html`);
    // this.mWindow.loadURL(`file://${getVortexPath('base')}/index.html?react_perf`);

    let cancelTimer: NodeJS.Timer;

    // opening the devtools automatically can be very useful if the renderer has
    // trouble loading the page
    // this.mWindow.webContents.openDevTools();
    this.mWindow.webContents.on('console-message' as any,
      (evt: Electron.Event, level: number, message: string) => {
        if (level !== 2) {
          // TODO: at the time of writing (electron 2.0.3) this event doesn't seem to
          //   provide the other parameters of the message.
          //   That is actually a known issue in chrome but the chrome people don't seem to care too
          //   much and wait for a PR by the electron people but those have closed the issue. fun
          log('info', message);
        } else if (cancelTimer === undefined) {
          // if an error is logged by the renderer and the window isn't shown within a reasonable time,
          // it was probably something terminal.
          // this isn't ideal as we don't have a stack trace of the error message here
          cancelTimer = setTimeout(() => {
            if (!this.mShown) {
              terminate({ message: 'Vortex failed to start', details: message }, {});
            }
          }, 15000);
        }
      });

    this.mWindow.webContents.on('crashed', (evt, killed) => {
      log('error', killed ? 'killed' : 'crashed');
      if (!killed) {
        store.dispatch(addNotification({
          type: 'error',
          message: 'Vortex restarted after a crash, sorry about that.',
        }));
        this.mWindow.loadURL(`file://${getVortexPath('base')}/index.html`);
      }
    });

    this.mWindow.webContents.on('did-fail-load', (evt, code, description, url) => {
      log('error', 'failed to load page', { code, description, url });
    });

    this.mWindow.webContents.session.on(
        'will-download', (event, item) => {
          event.preventDefault();
          this.mWindow.webContents.send('external-url', item.getURL());
          store.dispatch(addNotification({
            type: 'info',
            title: 'Download started',
            message: item.getFilename(),
            displayMS: 4000,
          }));
        });

    this.mWindow.webContents.on('new-window', (event, url, frameName, disposition) => {
      if (disposition === 'background-tab') {
        event.preventDefault();
      }
    });

    this.initEventHandlers(store);

    return new Promise<Electron.WebContents>((resolve) => {
      this.mWindow.once('ready-to-show', () => {
        resolve(this.mWindow.webContents);
      });
    });
  }

  public connectToTray(tray: TrayIcon) {
    tray.setMainWindow(this.mWindow);
  }

  public show(maximized: boolean) {
    this.mShown = true;
    this.mWindow.show();
    if (maximized) {
      this.mWindow.maximize();
    }
  }

  public sendExternalURL(url: string) {
    if (this.mWindow !== null) {
      this.mWindow.webContents.send('external-url', url);
    }
  }

  private getWindowSettings(windowMetrics: IWindow): Electron.BrowserWindowConstructorOptions {
    const {getSafe} = require('../util/storeHelper') as typeof storeHelperT;
    const screenArea = screen.getPrimaryDisplay().workAreaSize;
    const width = Math.max(1024, getSafe(windowMetrics, ['size', 'width'],
                                         Math.floor(screenArea.width * 0.8)));
    const height = Math.max(768, getSafe(windowMetrics, ['size', 'height'],
                                         Math.floor(screenArea.height * 0.8)));
    return {
      width,
      height,
      minWidth: 1024,
      minHeight: 768,
      x: getSafe(windowMetrics, ['position', 'x'], undefined),
      y: getSafe(windowMetrics, ['position', 'y'], undefined),
      autoHideMenuBar: true,
      frame: !getSafe(windowMetrics, ['customTitlebar'], true),
      show: false,
      title: 'Vortex',
      webPreferences: {
        nodeIntegrationInWorker: true,
      },
    };
  }

  private initEventHandlers(store: Redux.Store<IState>) {
    this.mWindow.on('closed', () => { this.mWindow = null; });
    this.mWindow.on('maximize', () => { store.dispatch(setMaximized(true)); });
    this.mWindow.on('unmaximize', () => { store.dispatch(setMaximized(false)); });
    this.mWindow.on('resize', () => { this.mResizeDebouncer.schedule(); });
    this.mWindow.on('move', () => { this.mMoveDebouncer.schedule(); });
  }
}

export default MainWindow;
