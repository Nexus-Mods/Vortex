import {delayed} from '../util/delayed';

import {Electron} from 'electron';

class SplashScreen {
  private mWindow: Electron.BrowserWindow = null;

  public fadeOut() {
    if (this.mWindow !== null) {
      // ensure the splash screen remains visible
      this.mWindow.setAlwaysOnTop(true);

      // don't fade out immediately, otherwise the it looks odd
      // as the main window appears at the same time
      return delayed(200)
          .then(() => this.mWindow.webContents.send('fade-out'))
          // wait for the fade out animation to finish before destroying
          // the window
          .then(() => delayed(500))
          .then(() => {
            this.mWindow.close();
            this.mWindow = null;
          });
    } else {
      return Promise.resolve();
    }
  }

  public create(): Promise<void> {
    const BrowserWindow: Electron.BrowserWindow = require('electron').BrowserWindow;

    return new Promise<void>((resolve, reject) => {
      const onReady = () => {
        this.mWindow.show();
        resolve();
      };

      this.mWindow = new BrowserWindow({
        frame: false,
        width: 520,
        height: 178,
        transparent: true,
        show: false,
        skipTaskbar: true,
        webPreferences: {
          javascript: false,
          webgl: false,
          backgroundThrottling: false,
          sandbox: false,
        },
      });
      this.mWindow.loadURL(`${__dirname}/../splash.html`);
      this.mWindow.once('ready-to-show', onReady);
    });
  }

}

export default SplashScreen;
