import Promise from 'bluebird';
import * as path from 'path';
import { pathToFileURL } from 'url';
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
              this.mWindow.webContents.executeJavaScript(`
                const splash = document.querySelector('.splash-image');
                if (splash) {
                  splash.style.transition = 'opacity 500ms ease-in-out';
                  splash.style.opacity = '0';
                }
              `);
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

  public create(disableGPU: boolean): Promise<void> {
    const BrowserWindow: typeof Electron.BrowserWindow = require('electron').BrowserWindow;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        log('warn', 'splash screen taking awfully long');
        resolve?.();
        resolve = undefined;
      }, 30000);

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
        width: 476,
        height: 167,
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

      const splashUrl = pathToFileURL(path.join(getVortexPath('base'), 'splash.html')).href;
      this.mWindow.loadURL(splashUrl);
      
      // Add disable-gpu class to body if GPU is disabled
      if (disableGPU) {
        this.mWindow.webContents.once('dom-ready', () => {
          this.mWindow.webContents.executeJavaScript(`
            document.body.classList.add('disable-gpu');
          `);
        });
      }
      this.mWindow.webContents.openDevTools();
    });
  }

  public getHandle(): Electron.BrowserWindow {
    return this.mWindow;
  }
}

export default SplashScreen;
