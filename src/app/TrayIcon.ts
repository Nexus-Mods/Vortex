import { IExtensionApi } from '../types/api';
import getVortexPath from '../util/getVortexPath';

import { app, Menu, NativeImage, Tray } from 'electron';
import * as path from 'path';

class TrayIcon {
  private mTrayIcon: Electron.Tray;
  private mApi: IExtensionApi;
  private mImagePath: string;

  constructor(api: IExtensionApi) {
    this.mApi = api;
    this.mImagePath = path.resolve(
        getVortexPath('assets'), 'images',
        process.platform === 'win32' ? 'vortex.ico' : 'vortex.png');
    this.mTrayIcon = new Tray(this.mImagePath);

    this.mTrayIcon.setContextMenu(Menu.buildFromTemplate([
      {label: 'Start Game', click: () => this.startGame()},
      {label: 'Quit', click: () => app.quit()},
    ]));

    this.mApi.events.on('show-balloon',
      (title: string, content: string) => this.showNotification(title, content));
  }

  private startGame() {
    this.mApi.events.emit('quick-launch');
  }

  private showNotification(title: string, content: string) {
    const icon = path.join(getVortexPath('assets'), 'images', 'vortex.png');
    this.mTrayIcon.displayBalloon({
      title,
      content,
      icon,
    });
  }
}

export default TrayIcon;
