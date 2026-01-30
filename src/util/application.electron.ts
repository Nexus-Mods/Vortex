import { app as appIn, BrowserWindow } from "electron";
import * as os from "os";
import type { IApplication } from "./application";
import { setApplication } from "./application";

class ElectronApplication implements IApplication {
  private mName: string;
  private mVersion: string;
  private mFocused: boolean;

  constructor() {
    if (process.type === "browser") {
      // Main process - use electron app directly
      this.mName = appIn.name;
      this.mVersion = appIn.getVersion();
      // In main process, check if any Vortex window is focused
      this.mFocused =
        BrowserWindow.getAllWindows().find((win) => win.isFocused()) !==
        undefined;
    } else {
      // Renderer process - use preload values
      this.mName = window.appName;
      this.mVersion = window.appVersion;
      // Track focus state via window events
      this.mFocused = true; // Assume focused initially

      // Register listeners to track focus state
      if (window.api?.window?.onFocus) {
        window.api.window.onFocus(() => {
          this.mFocused = true;
        });
      }
      if (window.api?.window?.onBlur) {
        window.api.window.onBlur(() => {
          this.mFocused = false;
        });
      }
    }
  }

  public get name() {
    return this.mName;
  }

  public get version() {
    return this.mVersion;
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
      void window.api.app.exit(exitCode);
    }
  }
}

setApplication(new ElectronApplication());
