import type * as Electron from "electron";

import type { VortexPaths } from "./ipc";

/** Globals exposed by the preload script to the renderer */
export interface PreloadWindow {
  api: Api;

  /** Environment version information */
  versions: Versions;

  /** Current window ID for window operations */
  windowId: number;

  /** Application name (for application.electron.ts) */
  appName: string;

  /** Application version (for application.electron.ts) */
  appVersion: string;

  /** All Vortex application paths (for getVortexPath) */
  vortexPaths: VortexPaths;
}

/** All API methods available to the renderer */
export interface Api {
  /** Example APIs */
  example: Example;

  /** Dialog APIs */
  dialog: Dialog;

  /** App APIs */
  app: App;

  /** BrowserView APIs */
  browserView: BrowserView;

  /** Session APIs */
  session: Session;

  /** Window APIs */
  window: WindowAPI;

  /** Menu APIs */
  menu: Menu;

  /** Content Tracing APIs */
  contentTracing: ContentTracing;

  /** Redux State APIs */
  redux: Redux;

  /** Clipboard APIs */
  clipboard: Clipboard;

  /** Power Save Blocker APIs */
  powerSaveBlocker: PowerSaveBlocker;
}

export interface Example {
  /** pong */
  ping(): Promise<string>;
}

export interface Dialog {
  /** Show open file/folder dialog */
  showOpen(
    options: Electron.OpenDialogOptions,
  ): Promise<Electron.OpenDialogReturnValue>;

  /** Show save file dialog */
  showSave(
    options: Electron.SaveDialogOptions,
  ): Promise<Electron.SaveDialogReturnValue>;

  /** Show message box dialog */
  showMessageBox(
    options: Electron.MessageBoxOptions,
  ): Promise<Electron.MessageBoxReturnValue>;

  /** Show error box (blocking) */
  showErrorBox(title: string, content: string): Promise<void>;
}

export interface App {
  /** Set as default protocol client */
  setProtocolClient(protocol: string, udPath: string): Promise<void>;

  /** Check if app is default protocol client */
  isProtocolClient(protocol: string, udPath: string): Promise<boolean>;

  /** Remove as default protocol client */
  removeProtocolClient(protocol: string, udPath: string): Promise<void>;

  /** Exit the application */
  exit(exitCode?: number): Promise<void>;

  /** Get application name */
  getName(): Promise<string>;

  /** Get app path */
  getPath(name: string): Promise<string>;

  /** Set app path */
  setPath(name: string, value: string): Promise<void>;

  /** Extract file icon */
  extractFileIcon(exePath: string, iconPath: string): Promise<void>;

  /** Set Windows jump list */
  setJumpList(categories: Electron.JumpListCategory[]): Promise<void>;

  /** Set login item settings (auto-start) */
  setLoginItemSettings(settings: Electron.Settings): Promise<void>;

  /** Get login item settings */
  getLoginItemSettings(): Promise<Electron.LoginItemSettings>;

  /** Get the current application directory */
  getAppPath(): Promise<string>;
}

export interface BrowserView {
  /** Create a new BrowserView */
  create(src: string, partition: string, isNexus: boolean): Promise<string>;

  /** Create a new BrowserView with event forwarding */
  createWithEvents(
    src: string,
    forwardEvents: string[],
    options?: Electron.BrowserViewConstructorOptions,
  ): Promise<string>;

  /** Close a BrowserView */
  close(viewId: string): Promise<void>;

  /** Position a BrowserView */
  position(
    viewId: string,
    rect: { x: number; y: number; width: number; height: number },
  ): Promise<void>;

  /** Update BrowserView URL */
  updateURL(viewId: string, newURL: string): Promise<void>;
}

export interface Session {
  /** Get session cookies */
  getCookies(filter: Electron.CookiesGetFilter): Promise<Electron.Cookie[]>;
}

export interface WindowAPI {
  /** Minimize window */
  minimize(windowId: number): Promise<void>;

  /** Maximize window */
  maximize(windowId: number): Promise<void>;

  /** Unmaximize (restore) window */
  unmaximize(windowId: number): Promise<void>;

  /** Restore minimized window */
  restore(windowId: number): Promise<void>;

  /** Close window */
  close(windowId: number): Promise<void>;

  /** Focus window */
  focus(windowId: number): Promise<void>;

  /** Show window */
  show(windowId: number): Promise<void>;

  /** Hide window */
  hide(windowId: number): Promise<void>;

  /** Check if window is maximized */
  isMaximized(windowId: number): Promise<boolean>;

  /** Check if window is minimized */
  isMinimized(windowId: number): Promise<boolean>;

  /** Check if window is focused */
  isFocused(windowId: number): Promise<boolean>;

  /** Set window always on top */
  setAlwaysOnTop(windowId: number, flag: boolean): Promise<void>;

  /** Move window to top of stack */
  moveTop(windowId: number): Promise<void>;

  /** Register listener for window maximize event. Returns unsubscribe function. */
  onMaximize(callback: () => void): () => void;

  /** Register listener for window unmaximize event. Returns unsubscribe function. */
  onUnmaximize(callback: () => void): () => void;

  /** Register listener for window close event. Returns unsubscribe function. */
  onClose(callback: () => void): () => void;

  /** Register listener for window focus event. Returns unsubscribe function. */
  onFocus(callback: () => void): () => void;

  /** Register listener for window blur event. Returns unsubscribe function. */
  onBlur(callback: () => void): () => void;

  /** Get window position */
  getPosition(windowId: number): Promise<[number, number]>;

  /** Set window position */
  setPosition(windowId: number, x: number, y: number): Promise<void>;

  /** Get window size */
  getSize(windowId: number): Promise<[number, number]>;

  /** Set window size */
  setSize(windowId: number, width: number, height: number): Promise<void>;

  /** Check if window is visible */
  isVisible(windowId: number): Promise<boolean>;

  /** Toggle developer tools */
  toggleDevTools(windowId: number): Promise<void>;
}

export interface Menu {
  /** Set application menu from template */
  setApplicationMenu(
    template: Electron.MenuItemConstructorOptions[],
  ): Promise<void>;

  /** Register listener for menu item clicks. Returns unsubscribe function. */
  onMenuClick(callback: (menuItemId: string) => void): () => void;
}

export interface ContentTracing {
  /** Start recording performance trace */
  startRecording(
    options: Electron.TraceCategoriesAndOptions | Electron.TraceConfig,
  ): Promise<void>;

  /** Stop recording and save to file, returns the path to the trace file */
  stopRecording(resultPath: string): Promise<string>;
}

export interface Redux {
  /** Get Redux state as JSON */
  getState(): Promise<unknown>;

  /** Get Redux state as msgpack (chunked transfer fallback) */
  getStateMsgpack(idx?: number): Promise<unknown>;
}

export interface Clipboard {
  /** Write text to clipboard */
  writeText(text: string): Promise<void>;

  /** Read text from clipboard */
  readText(): Promise<string>;
}

export interface PowerSaveBlocker {
  /** Start blocking power save mode */
  start(
    type: "prevent-app-suspension" | "prevent-display-sleep",
  ): Promise<number>;

  /** Stop blocking power save mode */
  stop(id: number): Promise<void>;

  /** Check if a blocker is started */
  isStarted(id: number): Promise<boolean>;
}

export interface Versions {
  node: string;
  chromium: string;
  electron: string;
}
