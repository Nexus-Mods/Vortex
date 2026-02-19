// NOTE(erri120): This file serves as the backbone for proper IPC usage.
// Everything in here is compile-time only, meaning the interfaces you find here
// are never used to create an object. They are only used for type inferrence.

import type {
  BrowserViewConstructorOptions,
  Cookie,
  CookiesGetFilter,
  JumpListCategory,
  LoginItemSettings,
  Settings,
  MessageBoxOptions,
  MessageBoxReturnValue,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
  TraceConfig,
  TraceCategoriesAndOptions,
} from "./electron";
import type { Level } from "./logging";
import type { PersistedHive, PersistedState } from "./state";

// NOTE(erri120): You should use unique channel names to prevent overlap. You can prefix
// channel names with an "area" like "example:" to somewhat categorize them and reduce the possibility of overlap.

/** A single diff operation for state persistence */
export interface DiffOperation {
  /** Whether to set or remove a value */
  type: "set" | "remove";
  /** Path to the value in state (e.g., ["settings", "window", "x"]) */
  path: string[];
  /** The value to set (only for "set" operations) - changing this to "Serializable" gives off infinite type errors */
  value?: unknown;
}

export interface AppInitMetadata {
  /** Command line arguments */
  commandLine: Record<string, unknown>;
  /** Install type (regular installer or managed like Epic/MS Store) */
  installType?: "regular" | "managed";
  /** Application version string */
  version?: string;
  /** Instance ID for crash reporting */
  instanceId?: string;
  /** Whether user was warned about admin (0 = not warned) */
  warnedAdmin?: number;
}

/** Status of the auto-updater in main process */
export interface UpdateStatus {
  /** Whether an update is available */
  available: boolean;
  /** Whether update is downloaded and ready to install */
  downloaded: boolean;
  /** Version of the available update */
  version?: string;
  /** Release notes/changelog for the update */
  releaseNotes?: string;
  /** Download progress (0-100) if downloading */
  downloadProgress?: number;
  /** Error message if update check failed */
  error?: string;
}

/** Vortex application paths - computed once in main process and shared */
export type VortexPaths = {
  [key: string]: string;
} & {
  base: string;
  assets: string;
  assets_unpacked: string;
  modules: string;
  modules_unpacked: string;
  bundledPlugins: string;
  locales: string;
  package: string;
  package_unpacked: string;
  application: string;
  userData: string;
  appData: string;
  localAppData: string;
  temp: string;
  home: string;
  documents: string;
  exe: string;
  desktop: string;
};

/** Type containing all known channels used by renderer processes to send messages to the main process */
export interface RendererChannels {
  // NOTE(erri120): Parameters must be serializable and return values must be void.

  /** Logs a message */
  "logging:log": (level: Level, message: string, metadata?: string) => void;

  // Examples:
  "example:renderer_foo": () => void;
  "example:renderer_bar": (data: number) => void;

  /** Relaunches the application with the given arguments */
  "app:relaunch": (args?: string[]) => void;

  /** Opens the URL using the default application registered for the protocol */
  "shell:openUrl": (url: string) => void;

  /** Opens the file using the default application for the file extension */
  "shell:openFile": (filePath: string) => void;

  // Persistence: Send diff operations to main for persistence
  "persist:diff": (hive: PersistedHive, operations: DiffOperation[]) => void;

  // Extensions: Initialize all main process extensions
  "extensions:init-all-main": (installType: string) => void;

  // Updater: Set update channel
  "updater:set-channel": (channel: string, manual: boolean) => void;

  // Updater: Check for updates
  "updater:check-for-updates": (channel: string, manual: boolean) => void;

  // Updater: Download the available update (installAfterDownload triggers auto-restart when done)
  "updater:download": (channel: string, installAfterDownload: boolean) => void;

  // Updater: Restart and install update
  "updater:restart-and-install": () => void;
}

/** Type containing all known channels used by the main process to send messages to a renderer process */
export interface MainChannels {
  // NOTE(erri120): Parameters must be serializable and return values must be void.

  // Examples:
  "example:main_foo": () => void;
  "example:main_bar": (data: string) => void;

  // Persistence: Send hydration data to renderer on startup
  "persist:hydrate": (hive: PersistedHive, data: Serializable) => void;

  // App initialization: Main sends all startup metadata to renderer in one message
  "app:init": (metadata: AppInitMetadata) => void;

  // Extensions: Response from main process after initializing an extension
  "extensions:init-main-response": (response: {
    extensionName: string;
    success: boolean;
    error?: string;
  }) => void;

  // BrowserView event forwarding
  // Dynamic channel: `view-${viewId}-${eventId}`
  // We use a pattern to match: view-*

  // Window event forwarding (main -> renderer)
  "window:event:maximize": () => void;
  "window:event:unmaximize": () => void;
  "window:event:close": () => void;
  "window:event:focus": () => void;
  "window:event:blur": () => void;

  // Menu click events (main -> renderer)
  "menu:click": (menuItemId: string) => void;
}

/** Type containing all known channels for synchronous IPC operations (used primarily by preload scripts) */
export interface SyncChannels {
  // NOTE: These are synchronous IPC channels used during preload initialization.
  // Use sparingly as they block the renderer process.
}

/** Type containing all known channels used by renderer processes to send to and receive messages from the main process */
export interface InvokeChannels {
  // NOTE(erri120): Parameters must be serializable and return values must be Promises resolving serializable content.

  // Examples:
  "example:ping": () => Promise<string>;

  // Persistence: Get all hydration data at startup (called once during init)
  "persist:get-hydration": () => Promise<Partial<PersistedState>>;

  // Updater: Query current update status from main process
  "updater:get-status": () => Promise<UpdateStatus>;
  // Dialog channels
  "dialog:showOpen": (
    options: OpenDialogOptions,
  ) => Promise<OpenDialogReturnValue>;
  "dialog:showSave": (
    options: SaveDialogOptions,
  ) => Promise<SaveDialogReturnValue>;
  "dialog:showMessageBox": (
    options: MessageBoxOptions,
  ) => Promise<MessageBoxReturnValue>;
  "dialog:showErrorBox": (title: string, content: string) => Promise<void>;

  // App protocol client channels
  "app:setProtocolClient": (protocol: string, udPath: string) => Promise<void>;
  "app:isProtocolClient": (
    protocol: string,
    udPath: string,
  ) => Promise<boolean>;
  "app:removeProtocolClient": (
    protocol: string,
    udPath: string,
  ) => Promise<void>;
  "app:exit": (exitCode?: number) => Promise<void>;
  "app:getName": () => Promise<string>;

  // App path channels
  "app:getPath": (name: string) => Promise<string>;
  "app:setPath": (name: string, value: string) => Promise<void>;

  // File icon extraction
  "app:extractFileIcon": (exePath: string, iconPath: string) => Promise<void>;

  // BrowserView channels
  "browserView:create": (
    src: string,
    partition: string,
    isNexus: boolean,
  ) => Promise<string>;
  "browserView:createWithEvents": (
    src: string,
    forwardEvents: string[],
    options?: BrowserViewConstructorOptions,
  ) => Promise<string>;
  "browserView:close": (viewId: string) => Promise<void>;
  "browserView:position": (
    viewId: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => Promise<void>;
  "browserView:updateURL": (viewId: string, newURL: string) => Promise<void>;

  // Jump list (Windows)
  "app:setJumpList": (categories: JumpListCategory[]) => Promise<void>;

  // Session cookies
  "session:getCookies": (filter: CookiesGetFilter) => Promise<Cookie[]>;

  // Window operations
  "window:getId": () => Promise<number>;
  "window:minimize": (windowId: number) => Promise<void>;
  "window:maximize": (windowId: number) => Promise<void>;
  "window:unmaximize": (windowId: number) => Promise<void>;
  "window:restore": (windowId: number) => Promise<void>;
  "window:close": (windowId: number) => Promise<void>;
  "window:focus": (windowId: number) => Promise<void>;
  "window:show": (windowId: number) => Promise<void>;
  "window:hide": (windowId: number) => Promise<void>;
  "window:isMaximized": (windowId: number) => Promise<boolean>;
  "window:isMinimized": (windowId: number) => Promise<boolean>;
  "window:isFocused": (windowId: number) => Promise<boolean>;
  "window:setAlwaysOnTop": (windowId: number, flag: boolean) => Promise<void>;
  "window:moveTop": (windowId: number) => Promise<void>;

  // Content tracing operations
  "contentTracing:startRecording": (
    options: TraceConfig | TraceCategoriesAndOptions,
  ) => Promise<void>;
  "contentTracing:stopRecording": (resultPath: string) => Promise<string>;

  // Redux state transfer
  // NOTE: Redux state is a complex nested object that is serializable
  // but too complex to type precisely. The actual data is always serializable.
  "redux:getState": () => Promise<{}>;
  // Returns a base64-encoded msgpack chunk of the Redux state
  "redux:getStateMsgpack": (idx?: number) => Promise<string | undefined>;

  // Login item settings
  "app:setLoginItemSettings": (settings: Settings) => Promise<void>;
  "app:getLoginItemSettings": () => Promise<LoginItemSettings>;

  // Clipboard operations
  "clipboard:writeText": (text: string) => Promise<void>;
  "clipboard:readText": () => Promise<string>;

  // Power save blocker
  "powerSaveBlocker:start": (
    type: "prevent-app-suspension" | "prevent-display-sleep",
  ) => Promise<number>;
  "powerSaveBlocker:stop": (id: number) => Promise<void>;
  "powerSaveBlocker:isStarted": (id: number) => Promise<boolean>;

  // App path - getAppPath returns the current application directory
  "app:getAppPath": () => Promise<string>;

  // App version - async alternative to app:getVersionSync
  "app:getVersion": () => Promise<string>;

  // Vortex paths - async alternative to vortex:getPathsSync
  "app:getVortexPaths": () => Promise<VortexPaths>;

  // Additional window operations
  "window:getPosition": (windowId: number) => Promise<[number, number]>;
  "window:setPosition": (
    windowId: number,
    x: number,
    y: number,
  ) => Promise<void>;
  "window:getSize": (windowId: number) => Promise<[number, number]>;
  "window:setSize": (
    windowId: number,
    width: number,
    height: number,
  ) => Promise<void>;
  "window:isVisible": (windowId: number) => Promise<boolean>;
  "window:toggleDevTools": (windowId: number) => Promise<void>;

  // Menu operations
  // Note: Menu template is complex with nested submenus (can be recursive), so we use unknown[]
  // to avoid circular type references - the actual expected type is SerializableMenuItem[]
  "menu:setApplicationMenu": (template: unknown[]) => Promise<void>;

  // Compile stylesheets
  "styles:compile": (filePaths: string[]) => Promise<string>;
}

/** Represents all IPC-safe typed arrays */
export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

/** Represents all IPC-safe primitives */
type SerializablePrimitive =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | void
  | Date
  | ArrayBuffer
  | SharedArrayBuffer
  | DataView
  | TypedArray;

/** Represents all IPC-safe types */
export type Serializable =
  | SerializablePrimitive
  | Serializable[]
  | { [key: string]: Serializable };

type IsAny<T> = 0 extends 1 & T ? true : false;

type HasError<T> = T extends { __error__: string }
  ? true
  : T extends object
    ? { [K in keyof T]: HasError<T[K]> }[keyof T] extends true
      ? true
      : false
    : false;

// NOTE(erri120): If you found this type because you got an error, that means you're trying to pass data across the IPC
// that can't be serialized. Check the list of supported types above and pick one of them. If you think there is a type missing
// from the list above, write a small proof and we can discuss it.
//
/** Utility type to assert that the type is serializable */
export type AssertSerializable<T> =
  // any
  IsAny<T> extends true
    ? { __error__: "any is not serializable for IPC" }
    : // known serializables
      T extends Serializable
      ? T
      : // objects
        T extends object
        ? HasError<{ [K in keyof T]: AssertSerializable<T[K]> }> extends true
          ? { __error__: "Type is not serializable for IPC" }
          : T
        : // everything else
          { __error__: "Type is not serializable for IPC" };

/** Utility type to check all args are serializable */
export type SerializableArgs<T extends readonly unknown[]> = {
  [K in keyof T]: AssertSerializable<T[K]>;
};
