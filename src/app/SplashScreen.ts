import Bluebird from 'bluebird';
import * as path from 'path';
import { pathToFileURL } from 'url';
import getVortexPath from '../util/getVortexPath';
import { log } from '../util/log';

class SplashScreen {
  private mWindow: Electron.BrowserWindow = null;

  public fadeOut() {
    // apparently we can't prevent the user from closing the splash with alt-f4...
    if ((this.mWindow === null) || this.mWindow.isDestroyed()) {
      return Bluebird.resolve();
    }
    // ensure the splash screen remains visible
    this.mWindow.setAlwaysOnTop(true);

    // don't fade out immediately, otherwise the it looks odd
    // as the main window appears at the same time
    return Bluebird.delay(200)
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
        .then(() => Bluebird.delay(500))
        .then(() => {
          if (!this.mWindow.isDestroyed()) {
            this.mWindow.close();
          }
          this.mWindow = null;
        });
  }

  public create(disableGPU: boolean): Bluebird<void> {
    const BrowserWindow: typeof Electron.BrowserWindow = require('electron').BrowserWindow;

    return new Bluebird<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        log('warn', 'splash screen taking awfully long');
        resolve?.();
        resolve = undefined;
      }, 1000);

      const onReady = () => {
        clearTimeout(timeout);
        this.mWindow.show();
        resolve?.();
        resolve = undefined;
      };

      this.mWindow = new BrowserWindow({
        frame: false,
        /*
        width: 687,
        height: 240,
        transparent: !disableGPU,
        */
        width: 475,
        height: 166,
        transparent: false,
        show: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,

        skipTaskbar: true,
        webPreferences: {
          javascript: true,
          webgl: false,
          backgroundThrottling: false,
          sandbox: false,
          nodeIntegration: true,
        },
      });

      this.mWindow.once('ready-to-show', onReady);

      this.mWindow.loadURL(
        pathToFileURL(path.join(getVortexPath('base'), 'splash.html')).href
        + `?disableGPU=${disableGPU ? 1 : 0}`);
      // this.mWindow.webContents.openDevTools();
    });
  }

  public getHandle(): Electron.BrowserWindow {
    return this.mWindow;
  }
}

export default SplashScreen;
