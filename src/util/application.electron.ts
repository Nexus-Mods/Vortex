import { app as appIn, BrowserWindow } from "electron";
import * as os from "os";

import type { IApplication } from "./application";

import { ApplicationData } from "../shared/applicationData";
import { setApplication } from "./application";
import { getPreloadWindow } from "./preloadAccess";

class ElectronApplication implements IApplication {
  private mFocused: boolean;

  constructor() {
    if (process.type === "browser") {
      // In main process, check if any Vortex window is focused
      this.mFocused =
        BrowserWindow.getAllWindows().find((win) => win.isFocused()) !==
        undefined;
    } else {
      // Track focus state via window events
      this.mFocused = true; // Assume focused initially

      // Register listeners to track focus state
      if (getPreloadWindow().api.window?.onFocus) {
        getPreloadWindow().api.window.onFocus(() => {
          this.mFocused = true;
        });
      }
      if (getPreloadWindow().api.window?.onBlur) {
        getPreloadWindow().api.window.onBlur(() => {
          this.mFocused = false;
        });
      }
    }
  }

  public get name() {
    // Lazy getter: read from ApplicationData (renderer) or electron app (main)
    if (process.type === "browser") {
      return appIn.name;
    }
    return ApplicationData.name ?? "Vortex";
  }

  public get version() {
    // Lazy getter: read from ApplicationData (renderer) or electron app (main)
    if (process.type === "browser") {
      return appIn.getVersion();
    }
    return ApplicationData.version ?? "0.0.0";
  }

  public get window(): BrowserWindow | null {
    // In renderer process, we can't return the actual BrowserWindow object
    // This property is not used anywhere in the codebase
    if (process.type === "browser") {
      // In main process, return the first visible window
      return BrowserWindow.getAllWindows()[0] ?? null;
    }
    return null;
  }

  public get memory(): { total: number } {
    return process.getSystemMemoryInfo();
  }

  public get platform(): string {
    return os.platform();
  }

  public get platformVersion(): string {
    return os.release();
  }

  /**
   * returns whether the window is in focus
   */
  public get isFocused(): boolean {
    if (process.type === "browser") {
      // In main process, check if any window is focused
      return (
        BrowserWindow.getAllWindows().find((win) => win.isFocused()) !==
        undefined
      );
    }
    // In renderer, return cached focus state (updated via events)
    return this.mFocused;
  }

  public quit(exitCode?: number): void {
    if (process.type === "browser") {
      appIn.exit(exitCode);
    } else {
      // In renderer, use the preload API
      void getPreloadWindow().api.app.exit(exitCode);
    }
  }
}

setApplication(new ElectronApplication());
