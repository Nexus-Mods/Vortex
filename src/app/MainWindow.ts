import {addNotification} from '../actions/notifications';
import {setMaximized, setWindowPosition,  setWindowSize} from '../actions/window';
import {IState, IWindow} from '../types/IState';
import Debouncer from '../util/Debouncer';
import * as storeHelperT from '../util/storeHelper';

import * as Promise from 'bluebird';
import { screen } from 'electron';
import * as Redux from 'redux';

class MainWindow {
  private mWindow: Electron.BrowserWindow = null;
  // timers used to prevent window resize/move from constantly causeing writes to the
  // store
  private mResizeDebouncer: Debouncer;
  private mMoveDebouncer: Debouncer;

  constructor(store: Redux.Store<IState>) {
    this.mResizeDebouncer = new Debouncer(() => {
      const size: number[] = this.mWindow.getSize();
      store.dispatch(setWindowSize({width: size[0], height: size[1]}));
      return null;
    }, 500);

    this.mMoveDebouncer = new Debouncer(() => {
      const pos: number[] = this.mWindow.getPosition();
      store.dispatch(setWindowPosition({x: pos[0], y: pos[1]}));
      return null;
    }, 500);
  }

  public create(store: Redux.Store<IState>): Promise<Electron.WebContents> {
    if (this.mWindow !== null) {
      return Promise.resolve(undefined);
    }
    const BrowserWindow: typeof Electron.BrowserWindow = require('electron').BrowserWindow;

    this.mWindow = new BrowserWindow(this.getWindowSettings(store.getState().settings.window));

    this.mWindow.loadURL(`file://${__dirname}/../index.html`);
    // this.mWindow.loadURL(`file://${__dirname}/../index.html?react_perf`);

    // opening the devtools automatically can be very useful if the renderer has
    // trouble loading the page
    // this.mWindow.webContents.openDevTools();

    this.mWindow.webContents.session.on(
        'will-download', (event, item, webContents) => {
          event.preventDefault();
          this.mWindow.webContents.send('external-url', item.getURL());
          store.dispatch(addNotification({
            type: 'info',
            title: 'Download started',
            message: item.getFilename(),
            displayMS: 4000,
          }));
        });

    this.initEventHandlers(store);

    return new Promise<Electron.WebContents>((resolve, reject) => {
      this.mWindow.once('ready-to-show', () => {
        resolve(this.mWindow.webContents);
      });
    });
  }

  public show(maximized: boolean) {
    const {getSafe} = require('../util/storeHelper') as typeof storeHelperT;
    this.mWindow.show();
    if (maximized) {
      this.mWindow.maximize();
    }

  }

  public sendExternalURL(url: string) {
    this.mWindow.webContents.send('external-url', url);
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
    this.mWindow.on('move', (evt) => { this.mMoveDebouncer.schedule(); });
  }
}

export default MainWindow;
