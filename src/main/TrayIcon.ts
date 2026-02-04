import type { IExtensionApi } from "../types/api";
import getVortexPath from "../util/getVortexPath";
import { log } from "../util/log";

import type { BrowserWindow } from "electron";
import { app, Menu, Tray } from "electron";
import * as path from "path";

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
  private mApi: IExtensionApi | null;
  private mImagePath: string;
  private mInitialized: boolean = false;

  constructor(api: IExtensionApi | null) {
    this.mApi = api;
    this.mImagePath = path.resolve(
      getVortexPath("assets"),
      "images",
      process.platform === "win32" ? "vortex.ico" : "vortex.png",
    );
    try {
      this.initTrayIcon();
    } catch (err) {
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

    this.mApi?.events?.on("show-balloon", (title: string, content: string) =>
      this.showNotification(title, content),
    );
    this.mInitialized = true;
  }

  private startGame() {
    this.mApi?.events?.emit("quick-launch");
  }

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
