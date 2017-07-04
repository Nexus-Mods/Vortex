import { app, Electron, Menu, Tray } from 'electron';
import * as path from 'path';

class TrayIcon {
  private mTrayIcon: Electron.Tray = null;

  constructor() {
    const imgPath = path.resolve(
        __dirname, '..', 'assets', 'images',
        process.platform === 'win32' ? 'vortex.ico' : 'vortex.png');
    this.mTrayIcon = new Tray(imgPath);

    this.mTrayIcon.setContextMenu(Menu.buildFromTemplate([
      {label: 'Quit', click: () => app.quit()},
    ]));
  }
}

export default TrayIcon;
