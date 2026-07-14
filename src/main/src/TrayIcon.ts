import path from "node:path";

import { BrowserWindow, Menu, Tray } from "electron";

import { getVortexPath } from "./getVortexPath";
import { log } from "./logging";

/**
 * Manages the system tray icon: clicking it toggles the main window
 * visibility and its context menu offers quitting the app.
 */
class TrayIcon {
  private mTrayIcon: Tray | undefined;
  private mImagePath: string;
  private mInitialized: boolean = false;

  constructor() {
    this.mImagePath = path.resolve(
      getVortexPath("assets"),
      "images",
      process.platform === "win32" ? "vortex.ico" : "vortex.png",
    );
    try {
      this.initTrayIcon();
    } catch {
      // This appears to be caused by a bug in electron. It happens randomly,
      // very rarely and the error message looks like it's entirely internal
      setTimeout(() => {
        try {
          this.initTrayIcon();
        } catch (err) {
          log("error", "failed to initialize tray icon", err);
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
    if (this.mTrayIcon === undefined || this.mTrayIcon.isDestroyed()) {
      return;
    }
    this.mTrayIcon.on("click", () => {
      if (window.isDestroyed()) {
        return;
      }
      if (process.env.VORTEX_E2E_HEADLESS === "1") {
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

    this.mTrayIcon.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Quit",
          click: () => {
            for (const win of BrowserWindow.getAllWindows()) {
              win.close();
            }
          },
        },
      ]),
    );

    this.mInitialized = true;
  }
}

export default TrayIcon;
