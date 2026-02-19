import type { BrowserWindow } from "electron";

import { app, Menu, Tray } from "electron";
import path from "node:path";

import getVortexPath from "./getVortexPath";
import { log } from "./logging";

/**
 * Manages the tray icon and its interactions.
 * With the toasts system in place, the tray icon interactions are pretty much
 * useless.
 *
 * The extension manager refactor work also makes this class obsolete as we're
 * not forwarding the IExtensionApi anymore.
 *
 * However, we might want to enhance the tray icon functionality in the future, so
 * we'll keep this class for now.
 *
 * @deprecated
 */
class TrayIcon {
  private mTrayIcon: Electron.Tray;
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
    if (this.mTrayIcon.isDestroyed()) {
      return;
    }
    this.mTrayIcon.on("click", () => {
      if (window.isDestroyed()) {
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
        { label: "Start Game", click: () => this.startGame() },
        { label: "Quit", click: () => app.quit() },
      ]),
    );

    this.mInitialized = true;
  }

  private startGame() {}

  private showNotification(title: string, content: string) {
    const icon = path.join(getVortexPath("assets"), "images", "vortex.png");
    if (!title || !content || this.mTrayIcon.isDestroyed()) {
      return;
    }
    log("debug", "showing balloon", { title, content });
    this.mTrayIcon.displayBalloon({
      title,
      content,
      icon,
      noSound: true,
    });
  }
}

export default TrayIcon;
