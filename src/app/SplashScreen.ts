import Promise from 'bluebird';
import getVortexPath from '../util/getVortexPath';
import { log } from '../util/log';

class SplashScreen {
  private mWindow: Electron.BrowserWindow = null;

  public fadeOut() {
    // apparently we can't prevent the user from closing the splash with alt-f4...
    if ((this.mWindow === null) || this.mWindow.isDestroyed()) {
      return Promise.resolve();
    }
    // ensure the splash screen remains visible
    this.mWindow.setAlwaysOnTop(true);

    // don't fade out immediately, otherwise the it looks odd
    // as the main window appears at the same time
    return Promise.delay(200)
        .then(() => {
          if (!this.mWindow.isDestroyed()) {
            try {
              this.mWindow.webContents.send('fade-out');
            } catch (err) {
              log('warn', 'failed to fade out splash screen', err.message);
            }
          }
        })
        // wait for the fade out animation to finish before destroying
        // the window
        .then(() => Promise.delay(500))
        .then(() => {
          if (!this.mWindow.isDestroyed()) {
            this.mWindow.close();
          }
          this.mWindow = null;
        });
  }

  public create(): Promise<void> {
    const BrowserWindow: typeof Electron.BrowserWindow = require('electron').BrowserWindow;

    return new Promise<void>((resolve, reject) => {
      const onReady = () => {
        this.mWindow.show();
        resolve();
      };

      this.mWindow = new BrowserWindow({
        frame: false,
        width: 700,
        height: 232,
        transparent: true,
        show: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,

        skipTaskbar: true,
        webPreferences: {
          javascript: false,
          webgl: false,
          backgroundThrottling: false,
          sandbox: false,
          nodeIntegration: true,
        },
      });
      this.mWindow.loadURL(`file://${getVortexPath('base')}/splash.html`);
      this.mWindow.once('ready-to-show', onReady);
    });
  }

  public getHandle(): Electron.BrowserWindow {
    return this.mWindow;
  }
}

export default SplashScreen;
