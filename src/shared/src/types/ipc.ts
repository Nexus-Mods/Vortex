// NOTE(erri120): This file serves as the backbone for proper IPC usage.
// Everything in here is compile-time only, meaning the interfaces you find here
// are never used to create an object. They are only used for type inferrence.

import type { SerializedVortexError } from "../errors/serialization";
import type { SerializedSpan } from "../telemetry/types";
import type { DownloadCheckpoint, DownloadProgress, DownloadStatus } from "./download";
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
import type { FeatureFlag } from "./flags";
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
  /** Whether the updater runs at all; decided in main, since the renderer cannot read the env */
  updaterActive?: boolean;
  /** Application version string */
  version?: string;
  /** Instance ID for crash reporting */
  instanceId?: string;
  /** Whether user was warned about admin (0 = not warned) */
  warnedAdmin?: number;
}

/**
 * What kind of update a download/staged installer represents. Patches
 * auto-download and install on restart; regular updates wait for the user;
 * downgrades only ever follow an explicit confirmation.
 */
export type UpdateKind = "patch" | "update" | "downgrade";

/**
 * The auto-updater as an explicit state machine (modeled on VS Code's
 * updater): exactly one state at a time, each carrying only the data valid
 * for it, so contradictory combinations (stale progress on an error, a patch
 * flag on a minor update) are unrepresentable. The UI renders purely from
 * the current state.
 */
export type UpdaterState =
  /** updates turned off (channel "none") */
  | { type: "disabled" }
  /** nothing on offer */
  | { type: "idle" }
  /** a check is in flight; manual checks always render visible feedback */
  | { type: "checking"; manual: boolean }
  /** a newer version needs a user decision to download */
  | { type: "available"; version: string; releaseNotes?: string }
  /**
   * the stable channel's latest is older than the running version; only ever
   * entered on a purposeful switch to stable, awaiting confirm/decline
   */
  | { type: "downgrade-offered"; version: string }
  /**
   * a download is running; percent is absent until the first progress event.
   * manual marks a download the user's own action set in motion (Download,
   * a confirmed downgrade, a manual check that found a patch), those render
   * visibly; only background-initiated patch downloads stay silent.
   */
  | { type: "downloading"; version: string; kind: UpdateKind; manual: boolean; percent?: number }
  /** downloaded and verified; installs on quit, or immediately via Restart Now */
  | { type: "staged"; version: string; kind: UpdateKind; releaseNotes?: string }
  /**
   * a check or download failed in a way the user should hear about; retry
   * carries the still-known update so a working Download can be offered
   */
  | {
      type: "error";
      message: string;
      manual: boolean;
      retry?: { version: string; releaseNotes?: string };
    };

/** The full updater snapshot pushed to (and queried by) the renderer */
export interface UpdaterSnapshot {
  state: UpdaterState;
  /**
   * Set on the first launch after an update: the version that was running
   * before. Drives the one-time "Vortex was updated" notice; orthogonal to
   * the state machine.
   */
  justUpdatedFrom?: string;
}

/**
 * Reply to `updater:get-status`. The renderer polls rather than being pushed
 * (the same model as downloads and uploads). `seq` counts snapshots recorded
 * so far; passing it back as `since` on the next poll returns every snapshot
 * after it in `changes`, so a state that lasted 300 ms is still delivered.
 * `snapshot` is always the latest.
 */
export interface UpdaterStatusResponse {
  seq: number;
  snapshot: UpdaterSnapshot;
  changes: UpdaterSnapshot[];
}

/** Vortex application paths */
export type VortexPaths = {
  base: string;
  base_unpacked: string;
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

export type WireEndpoint = {
  url: string;
  headers?: Record<string, string>;
};

export type WireResolvedResource = {
  probeEndpoint: WireEndpoint;
  chunkEndpoints?: WireEndpoint[];
};

export type WireDownloadState = DownloadProgress & {
  status: DownloadStatus;
  error: Serializable | null;
};

export type WireDownloadCheckpoint = DownloadCheckpoint<string>;

/**
 * The part layout an S3 multipart upload session was created with: one
 * presigned URL per part, plus the URL that closes the session. Mirrors the v3
 * API's `CreateMultipartUploadSuccess` in camelCase — that endpoint is defined
 * against the Amazon S3 multipart specification.
 */
export type WireS3MultipartLayout = {
  partSizeBytes: number;
  partPresignedUrls: string[];
  completePresignedUrl: string;
};

/**
 * Headers a presigned upload URL may cover with its signature. Whatever the
 * signature includes has to be sent with exactly the value the signer used —
 * a wrong value and a missing header fail identically, as
 * `SignatureDoesNotMatch`. The caller supplies them because only it knows what
 * the storage session was created with.
 */
export type WireUploadHeaders = {
  contentType?: string;
  contentDisposition?: string;
};

export type WireUploadRequest = {
  url: string;
  filePath: string;
  fileSize: number;
  /** Tags the `upload:progress` events emitted while this transfer runs. */
  uploadId: number;
  headers?: WireUploadHeaders;
};

export type WireS3MultipartRequest = {
  layout: WireS3MultipartLayout;
  filePath: string;
  fileSize: number;
  uploadId: number;
  headers?: WireUploadHeaders;
};

/**
 * Byte progress for an upload that is still running. `transferred` can move
 * backwards: a retried request restarts its body, and for a multipart upload
 * only the current part rewinds.
 */
export type WireUploadProgress = {
  transferred: number;
  total: number;
};

/**
 * The pair-shape envelope used by the invoke/handle and callback paths: the
 * channel's return value lives in `data`, the optional VortexError lives in
 * `error`. The receiver narrows on `error !== undefined` and deserializes-and-
 * throws when present. Sender and receiver are owned by us and every pair flows
 * through the better-IPC helpers, so no collision check is needed.
 */
export type WireReply<T> =
  | { data: T; error?: undefined }
  | { data?: undefined; error: SerializedVortexError };

export interface CallbackChannels {
  "example:ping": (ping: string) => Promise<{ pong: string }>;

  "download:resolve": () => Promise<WireResolvedResource>;
}

export type MainCallbackChannels = {
  [C in keyof CallbackChannels]: CallbackChannels[C] extends (
    ...args: infer Args
  ) => Promise<infer _Return>
    ? (collationId: number, ...args: Args) => void
    : never;
};

export type RendererCallbackChannels = {
  [C in keyof CallbackChannels as `callback:${C}`]: CallbackChannels[C] extends (
    ...args: infer _Args
  ) => Promise<infer Return>
    ? (collationId: number, result: Return) => void
    : never;
};

/** Type containing all known channels used by renderer processes to send messages to the main process */
export interface RendererChannels extends RendererCallbackChannels {
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

  /** Opens the OS file manager with the file selected */
  "shell:showItemInFolder": (filePath: string) => void;

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

  // Updater: Download the downgrade offered after an explicit switch to
  // stable. Ignored unless a downgrade offer is outstanding.
  "updater:download-downgrade": (installAfterDownload: boolean) => void;

  // Updater: Decline the outstanding downgrade offer. Clears the offer;
  // only another purposeful switch to stable raises it again.
  "updater:decline-downgrade": () => void;
  // Updater: stop the running download (the user dismissed its notification)
  "updater:cancel-download": () => void;

  // Updater: Restart and install update
  "updater:restart-and-install": () => void;

  // Telemetry: Forward a completed span from renderer to main for buffering/export
  "telemetry:forward-span": (span: SerializedSpan) => void;

  // Feature flags: renderer reports evaluation metrics to main for forwarding to Unleash
  "flags:metrics": (bucket: FlagMetricsBucket) => void;

  // Feature flags: renderer updates context (e.g. userId after login)
  "flags:setContext": (context: FlagContext) => void;
}

/** Type containing all known channels used by the main process to send messages to a renderer process */
export interface MainChannels extends MainCallbackChannels {
  // NOTE(erri120): Parameters must be serializable and return values must be void.

  // Examples:
  "example:main_foo": () => void;
  "example:main_bar": (data: string) => void;

  // Persistence: Send hydration data to renderer on startup
  "persist:hydrate": (hive: PersistedHive, data: Serializable) => void;

  // Persistence: Push state changes from main process to renderer (no feedback loop —
  // renderer applies via __persist_push which is excluded from persistDiffMiddleware)
  "persist:push": (hive: PersistedHive, operations: DiffOperation[]) => void;

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

  // Feature flags: main pushes updated flags after each successful poll
  "flags:synchronize": (flags: FeatureFlag[]) => void;
}

/** Context data the renderer can push to refine feature flag evaluation */
export interface FlagContext {
  userId?: string;
}

/** Evaluation counts for a single time bucket, sent from renderer to main */
export interface FlagMetricsBucket {
  /** Unix timestamp (ms) for the start of this bucket */
  start: number;
  /** Unix timestamp (ms) for the end of this bucket */
  stop: number;
  /** Per-flag evaluation counts */
  toggles: Record<string, { yes: number; no: number; variants?: Record<string, number> }>;
}

/** Hash algorithms the app requests over `hash:compute`. Closed set; extend as callers need. */
export type HashAlgorithm = "md5";

/** Type containing all known channels used by renderer processes to send to and receive messages from the main process */
export interface InvokeChannels {
  // NOTE(erri120): Parameters must be serializable and return values must be Promises resolving serializable content.

  // Examples:
  "example:ping": () => Promise<string>;

  // bsdiff binary patching, run on a main-process worker_thread (only paths cross IPC)
  "bsdiff:create": (oldPath: string, newPath: string, patchPath: string) => Promise<void>;
  "bsdiff:apply": (oldPath: string, patchPath: string, outputPath: string) => Promise<void>;

  // file hashing, run on a main-process worker_thread (only the path crosses IPC)
  "hash:compute": (
    algorithm: HashAlgorithm,
    filePath: string,
  ) => Promise<{ hash: string; numBytes: number }>;

  // Persistence: Get all hydration data at startup (called once during init)
  "persist:get-hydration": () => Promise<Partial<PersistedState>>;

  // Updater: the renderer polls this (pull, like downloads and uploads). With
  // `since`, the reply also lists every snapshot recorded after that sequence
  // number, so short-lived states are seen and not sampled past.
  "updater:get-status": (since?: number) => Promise<UpdaterStatusResponse>;
  // Updater: Release notes covering the update the app just went through
  // (null when the launch did not follow an update or notes are unavailable).
  // The renderer passes its persisted channel, the handler can be invoked
  // before the first check has established one in main.
  "updater:get-update-changelog": (channel: string) => Promise<string | null>;
  // Dialog channels
  "dialog:showOpen": (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>;
  "dialog:showSave": (options: SaveDialogOptions) => Promise<SaveDialogReturnValue>;
  "dialog:showMessageBox": (options: MessageBoxOptions) => Promise<MessageBoxReturnValue>;
  "dialog:showErrorBox": (title: string, content: string) => Promise<void>;

  // App protocol client channels
  "app:setProtocolClient": (protocol: string, udPath: string) => Promise<void>;
  "app:isProtocolClient": (protocol: string, udPath: string) => Promise<boolean>;
  "app:removeProtocolClient": (protocol: string, udPath: string) => Promise<void>;
  "app:exit": (exitCode?: number) => Promise<void>;
  "app:getName": () => Promise<string>;
  "app:getInitMetadata": () => Promise<AppInitMetadata>;

  // App path channels
  "app:getPath": (name: keyof VortexPaths) => Promise<string>;
  "app:setPath": (name: keyof VortexPaths, value: string) => Promise<void>;

  // File icon extraction
  "app:extractFileIcon": (exePath: string, iconPath: string) => Promise<void>;

  // BrowserView channels
  "browserView:create": (src: string, partition: string, isNexus: boolean) => Promise<string>;
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
  // NOTE: Redux state is a complex nested object that is serializable but too complex to type precisely. The actual data is always serializable.

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
  "window:setPosition": (windowId: number, x: number, y: number) => Promise<void>;
  "window:getSize": (windowId: number) => Promise<[number, number]>;
  "window:setSize": (windowId: number, width: number, height: number) => Promise<void>;
  "window:isVisible": (windowId: number) => Promise<boolean>;
  "window:toggleDevTools": (windowId: number) => Promise<void>;

  // Menu operations
  // Note: Menu template is complex with nested submenus (can be recursive), so we use unknown[]
  // to avoid circular type references - the actual expected type is SerializableMenuItem[]
  "menu:setApplicationMenu": (template: unknown[]) => Promise<void>;

  // Compile stylesheets
  "styles:compile": (filePaths: string[]) => Promise<string>;

  // Feature flags: get current flags from main process
  "flags:get-current": () => Promise<FeatureFlag[]>;

  // Download channels
  "download:start": (
    dest: string,
    collationId: number,
    downloadId?: string,
  ) => Promise<{ downloadId: string }>;
  "download:pause": (downloadId: string) => Promise<WireDownloadCheckpoint>;
  "download:resume": (checkpoint: WireDownloadCheckpoint) => Promise<void>;
  "download:cancel": (downloadId: string) => Promise<void>;
  "download:getState": (downloadId: string) => Promise<WireDownloadState>;
  "download:getStates": (downloadIds: string[]) => Promise<Record<string, WireDownloadState>>;
  "download:configure": (options: {
    concurrency?: number | string;
    bytesPerSecond?: number | string;
  }) => Promise<void>;

  // Upload channels
  "upload:file": (request: WireUploadRequest) => Promise<void>;
  "upload:s3-multipart": (request: WireS3MultipartRequest) => Promise<void>;
  /** Byte progress for a running upload, or null once it has settled. */
  "upload:getProgress": (uploadId: number) => Promise<WireUploadProgress | null>;
  /**
   * Stops a running upload; the call that started it rejects with an
   * `UploadError` carrying `cancellation`.
   */
  "upload:cancel": (uploadId: number) => Promise<void>;

  // Adaptor host — renderer queries adaptor services through these
  "adaptors:list": () => Promise<
    Array<{
      name: string;
      pid: string;
      provides: string[];
      requires: string[];
    }>
  >;
  "adaptors:call": (
    adaptorName: string,
    serviceUri: string,
    method: string,
    args: unknown[],
  ) => Promise<Serializable>;
  /**
   * Builds a store-path snapshot for a newly discovered game. The
   * renderer uses this instead of constructing path bases itself so the
   * adaptor can be handed a fully-resolved {@link StorePathProvider}.
   */
  "adaptors:build-snapshot": (store: string, gamePath: string) => Promise<Serializable>;

  /**
   * Executes a declarative version detection strategy on the main
   * process side (PE header read, text file parse, etc.).
   */
  "adaptors:detect-version": (source: {
    type: string;
    path: { value: string };
    regex?: string;
  }) => Promise<string>;
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

/**
 * Represents all IPC-safe types.
 *
 * This is **Electron's structured-clone contract**, not `JSON.stringify`.
 * Values of type `Serializable` survive `ipcMain.send`/`ipcRenderer.invoke`
 * and preserve `Date`, `Map`, `Set`, `ArrayBuffer`, typed arrays, etc.
 * They do **not** round-trip through `JSON.stringify` — Maps and Sets
 * serialize to `{}`, and typed arrays to their object form. Do not
 * `JSON.stringify` values of this type without first converting them to
 * a JSON-safe shape.
 */
export type Serializable =
  | SerializablePrimitive
  | Serializable[]
  | { [key: string]: Serializable }
  | Map<Serializable, Serializable>
  | Set<Serializable>;

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
