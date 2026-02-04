import type {
  DiffOperation,
  AppInitMetadata,
  PersistedHive,
  PersistedState,
  Serializable,
  UpdateStatus,
} from "./ipc";
import type { Level } from "./logging";

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

  /** Example APIs */
  example: Example;

  /** Persistence API - for syncing state to main process for storage */
  persist: PersistApi;

  /** Window API - for receiving window events from main process */
  window: WindowApi;

  /** App API - for receiving app-level events from main process */
  app: AppApi;

  /** Extensions API - for requesting main process initialization */
  extensions: ExtensionsApi;

  /** Updater API - for querying update status from main process */
  updater: UpdaterApi;
}

export interface Example {
  /** pong */
  ping(): Promise<string>;
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

/** API for renderer to receive window events from main process */
export interface WindowApi {
  /**
   * Register a callback for when window is resized.
   */
  onResized(callback: (width: number, height: number) => void): void;

  /**
   * Register a callback for when window is moved.
   */
  onMoved(callback: (x: number, y: number) => void): void;

  /**
   * Register a callback for when window maximize state changes.
   */
  onMaximized(callback: (maximized: boolean) => void): void;
}

/** API for renderer to receive app-level events from main process */
export interface AppApi {
  /**
   * Register a callback for app initialization metadata from main.
   * Called once during startup with all app metadata.
   */
  onInit(callback: (metadata: AppInitMetadata) => void): void;
}

/** API for requesting extension main process initialization */
export interface ExtensionsApi {
  /**
   * Initialize all main process extensions.
   * Should be called once after ExtensionManager is initialized.
   */
  initializeAllMain(installType: string): void;

  /**
   * Request main process initialization for a specific extension.
   * Returns a promise that resolves when the extension is initialized or fails.
   */
  requestMainInit(
    extensionName: string,
  ): Promise<{ success: boolean; error?: string }>;
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
