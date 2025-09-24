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

    // Close splash screen immediately without fade animation
    return Promise.delay(200)
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
      log('debug', 'loading splash screen from', splashUrl);
      this.mWindow.loadURL(splashUrl);
      
      // Add debug logging and disable-gpu class handling
      this.mWindow.webContents.once('dom-ready', () => {
        log('debug', 'splash screen DOM ready');
        
        if (disableGPU) {
          this.mWindow.webContents.executeJavaScript(`
            document.body.classList.add('disable-gpu');
          `);
        }
        
        // Check if images are loading correctly
        this.mWindow.webContents.executeJavaScript(`
          const splashElement = document.querySelector('.splash-image');
          if (splashElement) {
            const computedStyle = window.getComputedStyle(splashElement);
            const backgroundImage = computedStyle.backgroundImage;
            console.log('🖼️ Splash background image:', backgroundImage);
            
            // Test if image exists
            const img = new Image();
            img.onload = () => console.log('✅ Splash image loaded successfully');
            img.onerror = () => console.log('❌ Splash image failed to load');
            img.src = './assets/images/splash.png';
          } else {
            console.log('❌ Splash element not found');
          }
        `).catch(err => log('warn', 'failed to execute splash debug script', err.message));
      });
      // this.mWindow.webContents.openDevTools(); // Commented out to prevent dev tools from showing
    });
  }

  public getHandle(): Electron.BrowserWindow {
    return this.mWindow;
  }
}

export default SplashScreen;
