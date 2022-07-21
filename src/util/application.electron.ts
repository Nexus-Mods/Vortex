import { app as appIn, BrowserWindow } from 'electron';
import * as os from 'os';
import { IApplication, setApplication } from './application';

class ElectronApplication implements IApplication {
  private mName: string;
  private mVersion: string;
  private mFocused: () => boolean;
  private mWindow: BrowserWindow;
  private mApp: Electron.App;

  constructor() {
    const remote = process.type === 'browser' ? undefined : require('@electron/remote');
    this.mApp = remote?.app ?? appIn;

    this.mName = this.mApp.name;
    this.mVersion = this.mApp.getVersion();
    if (remote !== undefined) {
      this.mWindow = remote.getCurrentWindow();
    }
    // if called from renderer process, this will determine if this window is focused,
    // if called from browser process, it will determine if _any_ Vortex window is focused
    this.mFocused = (remote !== undefined)
      ? () => remote.getCurrentWindow().isFocused()
      : () => BrowserWindow.getAllWindows().find(win => win.isFocused()) !== undefined;
  }

  public get name() {
    return this.mName;
  }

  public get version() {
    return this.mVersion;
  }

  public get window(): BrowserWindow {
    return this.mWindow;
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
    return this.mFocused();
  }

  public quit(exitCode?: number): void  {
    this.mApp.exit(exitCode);
  }
}

setApplication(new ElectronApplication());
