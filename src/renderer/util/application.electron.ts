import type { BrowserWindow } from "electron";

import os from "node:os";

import type { IApplication } from "./application";

import { ApplicationData } from "@vortex/shared";
import { setApplication } from "./application";
import { getPreloadWindow } from "./preloadAccess";

class ElectronApplication implements IApplication {
  private mFocused: boolean;

  constructor() {
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

  public get name() {
    return ApplicationData.name ?? "Vortex";
  }

  public get version() {
    return ApplicationData.version ?? "0.0.0";
  }

  public get window(): BrowserWindow | null {
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
    return this.mFocused;
  }

  public quit(exitCode?: number): void {
    getPreloadWindow().api.app.exit(exitCode);
  }
}

setApplication(new ElectronApplication());
