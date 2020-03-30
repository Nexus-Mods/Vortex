import { IExtensionApi } from '../types/api';
import getVortexPath from '../util/getVortexPath';
import { log } from '../util/log';
import { truthy } from '../util/util';

import { app, BrowserWindow, Menu, Tray } from 'electron';
import * as path from 'path';

class TrayIcon {
  private mTrayIcon: Electron.Tray;
  private mApi: IExtensionApi;
  private mImagePath: string;
  private mInitialized: boolean = false;

  constructor(api: IExtensionApi) {
    this.mApi = api;
    this.mImagePath = path.resolve(
        getVortexPath('assets'), 'images',
        process.platform === 'win32' ? 'vortex.ico' : 'vortex.png');
    try {
      this.initTrayIcon();
    } catch (err) {
      // This appears to be caused by a bug in electron. It happens randomly,
      // very rarely and the error message looks like it's entirely internal
      setTimeout(() => {
        try {
          this.initTrayIcon();
        } catch (err) {
          log('error', 'failed to initialize tray icon', err.message);
        }
      }, 500);
    }
  }

  public get initialized() {
    return this.mInitialized;
  }

  public close() {
    if (this.mTrayIcon !== undefined) {
      this.mTrayIcon.destroy();
    }
  }

  public setMainWindow(window: BrowserWindow) {
    if (this.mTrayIcon.isDestroyed()) {
      return;
    }
    this.mTrayIcon.on('click', () => {
      if (window.isDestroyed()) {
        return;
      }
      if (window.isVisible()) {
        window.hide();
      } else {
        window.show();
      }
    });
  }

  private initTrayIcon() {
    this.mTrayIcon = new Tray(this.mImagePath);

    this.mTrayIcon.setContextMenu(Menu.buildFromTemplate([
      { label: 'Start Game', click: () => this.startGame() },
      { label: 'Quit', click: () => app.quit() },
    ]));

    this.mApi.events.on('show-balloon',
      (title: string, content: string) => this.showNotification(title, content));
    this.mInitialized = true;
  }

  private startGame() {
    this.mApi.events.emit('quick-launch');
  }

  private showNotification(title: string, content: string) {
    const icon = path.join(getVortexPath('assets'), 'images', 'vortex.png');
    if (!truthy(title) || !truthy(content)) {
      return;
    }
    log('debug', 'showing balloon', { title, content });
    this.mTrayIcon.displayBalloon({
      title,
      content,
      icon,
      noSound: true,
    });
  }
}

export default TrayIcon;
