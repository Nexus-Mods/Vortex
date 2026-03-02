import type {
  BrowserViewConstructorOptions,
  Cookie,
  CookiesGetFilter,
  JumpListCategory,
  LoginItemSettings,
  Settings,
  MenuItemConstructorOptions,
  MessageBoxOptions,
  MessageBoxReturnValue,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
  TraceConfig,
  TraceCategoriesAndOptions,
} from "./electron";
import type {
  DiffOperation,
  AppInitMetadata,
  Serializable,
  UpdateStatus,
  VortexPaths,
} from "./ipc";
import type { Level } from "./logging";
import type { PersistedHive, PersistedState } from "./state";

/** Globals exposed by the preload script to the renderer */
export interface PreloadWindow {
  api: Api;

  /** Environment version information */
  versions: Versions;
}

/** All API methods available to the renderer */
export interface Api {
  /** Sends a log message to the main process */
  log(level: Level, message: string, metadata?: string): void;

  /** Compiles SASS stylesheets to CSS */
  compileStylesheets(files: string[]): Promise<string>;

  /** Example APIs */
  example: Example;

  /** Persistence API - for syncing state to main process for storage */
  persist: PersistApi;

  /** Extensions API - for requesting main process initialization */
  extensions: ExtensionsApi;

  /** Updater API - for querying update status from main process */
  updater: UpdaterApi;
  /** Dialog APIs */
  dialog: Dialog;

  /** App APIs */
  app: App;

  /** Shell APIs */
  shell: Shell;

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

export interface Shell {
  /** Opens the URL using the default application registered for the protocol */
  openUrl(url: string): void;

  /** Opens the file using the default application for the file extension */
  openFile(filePath: string): void;
}

export interface Dialog {
  /** Show open file/folder dialog */
  showOpen(options: OpenDialogOptions): Promise<OpenDialogReturnValue>;

  /** Show save file dialog */
  showSave(options: SaveDialogOptions): Promise<SaveDialogReturnValue>;

  /** Show message box dialog */
  showMessageBox(options: MessageBoxOptions): Promise<MessageBoxReturnValue>;

  /** Show error box (blocking) */
  showErrorBox(title: string, content: string): Promise<void>;
}

export interface App {
  /** Relaunches the application with the given arguments */
  relaunch(args?: string[]): void;

  /**
   * Register a callback for app initialization metadata from main.
   * Called once during startup with all app metadata.
   */
  onInit(callback: (metadata: AppInitMetadata) => void): void;

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
  setJumpList(categories: JumpListCategory[]): Promise<void>;

  /** Set login item settings (auto-start) */
  setLoginItemSettings(settings: Settings): Promise<void>;

  /** Get login item settings */
  getLoginItemSettings(): Promise<LoginItemSettings>;

  /** Get the current application directory */
  getAppPath(): Promise<string>;

  /** Get application version (async alternative to window.appVersion) */
  getVersion(): Promise<string>;

  /** Get all Vortex paths (async alternative to window.vortexPaths) */
  getVortexPaths(): Promise<VortexPaths>;
}

export interface BrowserView {
  /** Create a new BrowserView */
  create(src: string, partition: string, isNexus: boolean): Promise<string>;

  /** Create a new BrowserView with event forwarding */
  createWithEvents(
    src: string,
    forwardEvents: string[],
    options?: BrowserViewConstructorOptions,
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
  getCookies(filter: CookiesGetFilter): Promise<Cookie[]>;
}

export interface WindowAPI {
  /** Get the current window ID */
  getId(): Promise<number>;

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

  /** Register listener for window resize event (from MainWindow debouncer). Returns unsubscribe function. */
  onResized(callback: (width: number, height: number) => void): () => void;

  /** Register listener for window move event (from MainWindow debouncer). Returns unsubscribe function. */
  onMoved(callback: (x: number, y: number) => void): () => void;

  /** Register listener for window maximized state change. Returns unsubscribe function. */
  onMaximized(callback: (maximized: boolean) => void): () => void;

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

/** Serializable menu item (without click handler function) */
export type SerializableMenuItem = Omit<MenuItemConstructorOptions, "click"> & {
  submenu?: SerializableMenuItem[];
};

export interface Menu {
  /** Register listener for menu item clicks. Returns unsubscribe function. */
  onMenuClick(callback: (menuItemId: string) => void): () => void;

  /** Set the application menu (template should have click handlers removed and replaced with IDs) */
  setApplicationMenu(template: SerializableMenuItem[]): Promise<void>;
}

export interface ContentTracing {
  /** Start recording performance trace */
  startRecording(
    options: TraceCategoriesAndOptions | TraceConfig,
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

/** API for renderer to communicate state changes to main for persistence */
export interface PersistApi {
  /**
   * Send diff operations to main process for persistence.
   * Called by the persistence middleware after each state change.
   */
  sendDiff(hive: PersistedHive, operations: DiffOperation[]): void;

  /**
   * Get all hydration data from main process at startup.
   * Returns persisted state for all hives.
   */
  getHydration(): Promise<Partial<PersistedState>>;

  /**
   * Register a callback for when main sends hydration data.
   * Used for incremental hydration updates after initial load.
   */
  onHydrate(callback: (hive: PersistedHive, data: Serializable) => void): void;
}

/** API for requesting extension main process initialization */
export interface ExtensionsApi {
  /**
   * Initialize all main process extensions.
   * Should be called once after ExtensionManager is initialized.
   */
  initializeAllMain(installType: string): void;
}

/** API for querying update status from main process */
export interface UpdaterApi {
  /**
   * Get current update status from main process.
   */
  getStatus(): Promise<UpdateStatus>;

  /**
   * Set the update channel and trigger an update check.
   */
  setChannel(channel: string, manual: boolean): void;

  /**
   * Check for updates on the specified channel.
   */
  checkForUpdates(channel: string, manual: boolean): void;

  /**
   * Download the available update on the specified channel.
   * If installAfterDownload is true, automatically restart and install when download completes.
   */
  downloadUpdate(channel: string, installAfterDownload?: boolean): void;

  /**
   * Trigger restart and install of the downloaded update.
   */
  restartAndInstall(): void;
}
