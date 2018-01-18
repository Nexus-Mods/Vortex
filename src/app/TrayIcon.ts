import { app, Menu, Tray } from 'electron';
import * as path from 'path';
import { IExtensionApi } from '../types/api';

class TrayIcon {
  private mTrayIcon: Electron.Tray;
  private mApi: IExtensionApi;

  constructor() {
    const imgPath = path.resolve(
        __dirname, '..', 'assets', 'images',
        process.platform === 'win32' ? 'vortex.ico' : 'vortex.png');
    this.mTrayIcon = new Tray(imgPath);

    this.mTrayIcon.setContextMenu(Menu.buildFromTemplate([
      {label: 'Start Game', click: () => this.startGame()},
      {label: 'Quit', click: () => app.quit()},
    ]));
  }

  public setApi(api: IExtensionApi) {
    this.mApi = api;
  }

  private startGame() {
    this.mApi.events.emit('quick-launch');
  }
}

export default TrayIcon;
