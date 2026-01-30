// NOTE(erri120): This file serves as the backbone for proper IPC usage.
// Everything in here is compile-time only, meaning the interfaces you find here
// are never used to create an object. They are only used for type inferrence.

// NOTE(erri120): You should use unique channel names to prevent overlap. You can prefix
// channel names with an "area" like "example:" to somewhat categorize them and reduce the possibility of overlap.

/** Type containing all known channels used by renderer processes to send messages to the main process */
export interface RendererChannels {
  // NOTE(erri120): Parameters must be serializable and return values must be void.

  // Examples:
  "example:renderer_foo": () => void;
  "example:renderer_bar": (data: number) => void;
}

/** Type containing all known channels used by the main process to send messages to a renderer process */
export interface MainChannels {
  // NOTE(erri120): Parameters must be serializable and return values must be void.

  // Examples:
  "example:main_foo": () => void;
  "example:main_bar": (data: string) => void;

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

/** Type containing all known channels for synchronous IPC operations (used primarily by preload scripts) */
export interface SyncChannels {
  // NOTE(erri120): These are synchronous IPC channels used during preload initialization.
  // Use sparingly as they block the renderer process.

  /** Get the current window ID */
  "window:getIdSync": () => number;

  /** Get the application name */
  "app:getNameSync": () => string;

  /** Get the application version */
  "app:getVersionSync": () => string;

  /** Get all Vortex paths - computed in main process */
  "vortex:getPathsSync": () => VortexPaths;
}

/** Type containing all known channels used by renderer processes to send to and receive messages from the main process */
export interface InvokeChannels {
  // NOTE(erri120): Parameters must be serializable and return values must be Promises resolving serializable content.

  // Examples:
  "example:ping": () => Promise<string>;

  // Dialog channels
  // NOTE: Electron types are marked as 'any' because they contain non-serializable properties
  // that Electron's IPC handles internally. The actual data passed is serializable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  "dialog:showOpen": (options: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  "dialog:showSave": (options: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  "dialog:showMessageBox": (options: any) => Promise<any>;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any,
  ) => Promise<string>;
  "browserView:close": (viewId: string) => Promise<void>;
  "browserView:position": (
    viewId: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => Promise<void>;
  "browserView:updateURL": (viewId: string, newURL: string) => Promise<void>;

  // Jump list (Windows)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  "app:setJumpList": (categories: any) => Promise<void>;

  // Session cookies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  "session:getCookies": (filter: any) => Promise<any>;

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

  // Menu operations
  // NOTE: Electron MenuItemConstructorOptions is marked as 'any' because it contains non-serializable
  // properties (functions) that Electron's IPC strips during transmission. The main process
  // reconstructs these functions (click handlers) before passing to Electron.Menu.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  "menu:setApplicationMenu": (template: any) => Promise<void>;

  // Content tracing operations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  "contentTracing:startRecording": (options: any) => Promise<void>;
  "contentTracing:stopRecording": (resultPath: string) => Promise<string>;

  // Redux state transfer
  // NOTE: Redux state is marked as 'any' because it's a complex nested object that is serializable
  // but too complex to type precisely. The actual data is always serializable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  "redux:getState": () => Promise<any>;
  // Returns a base64-encoded msgpack chunk of the Redux state
  "redux:getStateMsgpack": (idx?: number) => Promise<string | undefined>;

  // Login item settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  "app:setLoginItemSettings": (settings: any) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  "app:getLoginItemSettings": () => Promise<any>;

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

/** Represents all IPC-safe types */
export type Serializable =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | void
  | Date
  | Serializable[]
  | { [key: string]: Serializable }
  | Map<Serializable, Serializable>
  | Set<Serializable>
  | ArrayBuffer
  | SharedArrayBuffer
  | DataView
  | TypedArray;

// NOTE(erri120): If you found this type because you got an error, that means you're trying to pass data across the IPC
// that can't be serialized. Check the list of supported types above and pick one of them. If you think there is a type missing
// from the list above, write a small proof and we can discuss it.

// NOTE(erri120): Alternative is using `never` in the fallback but that doesn't produce very nice error messages.
/** Utility type to assert that the type is serializable */
export type AssertSerializable<T> = T extends Serializable
  ? T
  : { __error__: "Type is not serializable for IPC" };

/** Utility type to check all args are serializable */
export type SerializableArgs<T extends readonly unknown[]> = {
  [K in keyof T]: AssertSerializable<T[K]>;
};
