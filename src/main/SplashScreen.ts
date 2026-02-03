import { BrowserWindow } from "electron";
import * as path from "path";
import { pathToFileURL } from "url";

import getVortexPath from "./getVortexPath";
import { log } from "./logging";

class SplashScreen {
  private mWindow: Electron.BrowserWindow | null = null;

  public async fadeOut(): Promise<void> {
    // apparently we can't prevent the user from closing the splash with alt-f4...
    if (this.mWindow === null || this.mWindow.isDestroyed()) return;

    // ensure the splash screen remains visible
    this.mWindow.setAlwaysOnTop(true);

    // don't fade out immediately, otherwise the it looks odd
    // as the main window appears at the same time

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(() => resolve(), ms);
      });

    await delay(200);

    if (!this.mWindow?.isDestroyed()) {
      try {
        this.mWindow?.webContents.send("fade-out");
      } catch (err) {
        log("warn", "failed to fade out splash screen", err);
      }
    }

    await delay(500);

    if (!this.mWindow?.isDestroyed()) {
      this.mWindow?.close();
    }

    this.mWindow = null;
  }

  public create(disableGPU?: boolean): Promise<void> {
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        log("warn", "splash screen taking awfully long");
        resolve();
      }, 1000);

      const onReady = () => {
        clearTimeout(timeout);
        this.mWindow?.show();
        resolve();
      };

      this.mWindow = new BrowserWindow({
        frame: false,
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

      this.mWindow.once("ready-to-show", onReady);

      this.mWindow
        .loadURL(
          pathToFileURL(path.join(getVortexPath("base"), "splash.html")).href +
            `?disableGPU=${disableGPU ? 1 : 0}`,
        )
        .catch((err: unknown) =>
          log("error", "failed to load splash screen URL", err),
        );
    });
  }

  public getHandle(): Electron.BrowserWindow | null {
    return this.mWindow;
  }
}

export default SplashScreen;
