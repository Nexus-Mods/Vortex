import { type ErrorOriginTracker, rehydrateSerializedError, serializeError } from "@vortex/shared";
import type {
  AppInitMetadata,
  RendererChannels,
  InvokeChannels,
  MainChannels,
  CallbackChannels,
  SerializableArgs,
  AssertSerializable,
  Serializable,
  SerializedError,
  WireResult,
} from "@vortex/shared/ipc";
import type { PreloadWindow } from "@vortex/shared/preload";
import type { PersistedHive } from "@vortex/shared/state";
import { contextBridge, ipcRenderer } from "electron";

// NOTE(erri120): Welcome to the preload script. This is the correct and safe place to expose data and methods to the renderer. Here are a few rules and tips to make your life easier:
// 1) Never expose anything electron related to the renderer. This is what the preload script is for.
// 2) Use betterIpcRenderer defined below instead of raw ipcRenderer.

const betterIpcRenderer = {
  invoke: rendererInvoke,
  send: rendererSend,
  on: rendererOn,
  off: rendererOff,
  callback: rendererCallback,
};

// Pass renderer-owned errors by reference across the IPC round-trip: a callback
// error serialized here (rendererCallback) is stashed live and handed straight
// back when its proxied copy returns (rendererInvoke) — preserving identity,
// prototype and the real throw-site stack. Bounded, so a one-way error that
// never returns is evicted rather than retained; an evicted ref just falls back
// to generic-Error hydration. The renderer and preload share one V8 context
// (contextIsolation is off for the main window), so the stashed object is the
// same one the callback threw. The "renderer" namespace keeps these refs
// distinct from any tracker main owns.
const ORIGIN_STASH_MAX = 512;
const originStash = new Map<string, Error>();
let originSeq = 0;
const errorOriginTracker: ErrorOriginTracker = {
  namespace: "renderer",
  capture: (err: Error): string => {
    const id = `${originSeq++}`;
    originStash.set(id, err);
    if (originStash.size > ORIGIN_STASH_MAX) {
      const oldest = originStash.keys().next().value;
      if (oldest !== undefined) originStash.delete(oldest);
    }
    return id;
  },
  resolve: (id: string): Error | undefined => {
    const err = originStash.get(id);
    if (err !== undefined) originStash.delete(id);
    return err;
  },
};

try {
  expose("versions", {
    chromium: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  });

  expose("api", {
    log: (level, message, metadata) =>
      betterIpcRenderer.send("logging:log", level, message, metadata),

    compileStylesheets: (filePaths) => betterIpcRenderer.invoke("styles:compile", filePaths),

    example: {
      ping: () => betterIpcRenderer.invoke("example:ping"),
    },

    shell: {
      openUrl: (url) => betterIpcRenderer.send("shell:openUrl", url),
      openFile: (filePath) => betterIpcRenderer.send("shell:openFile", filePath),
    },

    persist: {
      sendDiff: (hive, operations) => betterIpcRenderer.send("persist:diff", hive, operations),

      // Synchronous variant used only on quit (beforeunload): blocks until main
      // has queued the ops so the final batch is persisted before teardown.
      // Raw ipcRenderer because betterIpcRenderer has no sendSync helper.
      sendDiffSync: (hive, operations) => {
        ipcRenderer.sendSync("persist:diff-sync", hive, operations);
      },

      getHydration: () => betterIpcRenderer.invoke("persist:get-hydration"),

      onHydrate: (callback: (hive: PersistedHive, data: Serializable) => void) =>
        betterIpcRenderer.on("persist:hydrate", (_, hive, data) => callback(hive, data)),

      onPush: (callback) =>
        betterIpcRenderer.on("persist:push", (_, hive, operations) => callback(hive, operations)),
    },

    extensions: {
      initializeAllMain: (installType: string) =>
        betterIpcRenderer.send("extensions:init-all-main", installType),
    },

    adaptors: {
      list: () => betterIpcRenderer.invoke("adaptors:list"),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      listWithInfoSync: () => ipcRenderer.sendSync("adaptors:list-with-info"),
      call: (adaptorName: string, serviceUri: string, method: string, args: unknown[]) =>
        betterIpcRenderer.invoke("adaptors:call", adaptorName, serviceUri, method, args),
      buildSnapshot: (store: string, gamePath: string) =>
        betterIpcRenderer.invoke("adaptors:build-snapshot", store, gamePath),
      detectVersion: (source: { type: string; path: { value: string }; regex?: string }) =>
        betterIpcRenderer.invoke("adaptors:detect-version", source),
    },

    updater: {
      getStatus: () => betterIpcRenderer.invoke("updater:get-status"),
      setChannel: (channel: string, manual: boolean) =>
        betterIpcRenderer.send("updater:set-channel", channel, manual),
      checkForUpdates: (channel: string, manual: boolean) =>
        betterIpcRenderer.send("updater:check-for-updates", channel, manual),
      downloadUpdate: (channel: string, installAfterDownload: boolean = false) =>
        betterIpcRenderer.send("updater:download", channel, installAfterDownload),
      restartAndInstall: () => betterIpcRenderer.send("updater:restart-and-install"),
    },

    dialog: {
      showOpen: (options) => betterIpcRenderer.invoke("dialog:showOpen", options),
      showSave: (options) => betterIpcRenderer.invoke("dialog:showSave", options),
      showMessageBox: (options) => betterIpcRenderer.invoke("dialog:showMessageBox", options),
      showErrorBox: (title, content) =>
        betterIpcRenderer.invoke("dialog:showErrorBox", title, content),
    },
    app: {
      relaunch: (args) => betterIpcRenderer.send("app:relaunch", args),
      getInitMetadata: (): Promise<AppInitMetadata> =>
        betterIpcRenderer.invoke("app:getInitMetadata"),
      setProtocolClient: (protocol: string, udPath: string) =>
        betterIpcRenderer.invoke("app:setProtocolClient", protocol, udPath),
      isProtocolClient: (protocol: string, udPath: string) =>
        betterIpcRenderer.invoke("app:isProtocolClient", protocol, udPath),
      removeProtocolClient: (protocol: string, udPath: string) =>
        betterIpcRenderer.invoke("app:removeProtocolClient", protocol, udPath),
      exit: (exitCode: number) => betterIpcRenderer.invoke("app:exit", exitCode),
      getName: () => betterIpcRenderer.invoke("app:getName"),
      getPath: (name) => betterIpcRenderer.invoke("app:getPath", name),
      extractFileIcon: (exePath: string, iconPath: string) =>
        betterIpcRenderer.invoke("app:extractFileIcon", exePath, iconPath),
      setJumpList: (categories) => betterIpcRenderer.invoke("app:setJumpList", categories),
      setLoginItemSettings: (settings) =>
        betterIpcRenderer.invoke("app:setLoginItemSettings", settings),
      getLoginItemSettings: () => betterIpcRenderer.invoke("app:getLoginItemSettings"),
      getAppPath: () => betterIpcRenderer.invoke("app:getAppPath"),
      getVersion: () => betterIpcRenderer.invoke("app:getVersion"),
      getVortexPaths: () => betterIpcRenderer.invoke("app:getVortexPaths"),
    },
    browserView: {
      create: (src: string, partition: string, isNexus: boolean) =>
        betterIpcRenderer.invoke("browserView:create", src, partition, isNexus),
      createWithEvents: (src, forwardEvents, options) =>
        betterIpcRenderer.invoke("browserView:createWithEvents", src, forwardEvents, options),
      close: (viewId: string) => betterIpcRenderer.invoke("browserView:close", viewId),
      position: (viewId: string, rect: Electron.Rectangle) =>
        betterIpcRenderer.invoke("browserView:position", viewId, rect),
      updateURL: (viewId: string, newURL: string) =>
        betterIpcRenderer.invoke("browserView:updateURL", viewId, newURL),
    },
    session: {
      getCookies: (filter) => betterIpcRenderer.invoke("session:getCookies", filter),
    },
    window: {
      getId: () => betterIpcRenderer.invoke("window:getId"),
      minimize: (windowId: number) => betterIpcRenderer.invoke("window:minimize", windowId),
      maximize: (windowId: number) => betterIpcRenderer.invoke("window:maximize", windowId),
      unmaximize: (windowId: number) => betterIpcRenderer.invoke("window:unmaximize", windowId),
      restore: (windowId: number) => betterIpcRenderer.invoke("window:restore", windowId),
      close: (windowId: number) => betterIpcRenderer.invoke("window:close", windowId),
      focus: (windowId: number) => betterIpcRenderer.invoke("window:focus", windowId),
      show: (windowId: number) => betterIpcRenderer.invoke("window:show", windowId),
      hide: (windowId: number) => betterIpcRenderer.invoke("window:hide", windowId),
      isMaximized: (windowId: number) => betterIpcRenderer.invoke("window:isMaximized", windowId),
      isMinimized: (windowId: number) => betterIpcRenderer.invoke("window:isMinimized", windowId),
      isFocused: (windowId: number) => betterIpcRenderer.invoke("window:isFocused", windowId),
      setAlwaysOnTop: (windowId: number, flag: boolean) =>
        betterIpcRenderer.invoke("window:setAlwaysOnTop", windowId, flag),
      moveTop: (windowId: number) => betterIpcRenderer.invoke("window:moveTop", windowId),
      onClose: (callback) => {
        const listener = () => callback();
        ipcRenderer.on("window:event:close", listener);
        return () => ipcRenderer.removeListener("window:event:close", listener);
      },
      onFocus: (callback) => {
        const listener = () => callback();
        ipcRenderer.on("window:event:focus", listener);
        return () => ipcRenderer.removeListener("window:event:focus", listener);
      },
      onBlur: (callback) => {
        const listener = () => callback();
        ipcRenderer.on("window:event:blur", listener);
        return () => ipcRenderer.removeListener("window:event:blur", listener);
      },
      onResized: (callback: (width: number, height: number) => void) => {
        const listener = (_: Electron.IpcRendererEvent, width: number, height: number) =>
          callback(width, height);
        ipcRenderer.on("window:resized", listener);
        return () => ipcRenderer.removeListener("window:resized", listener);
      },
      onMoved: (callback: (x: number, y: number) => void) => {
        const listener = (_: Electron.IpcRendererEvent, x: number, y: number) => callback(x, y);
        ipcRenderer.on("window:moved", listener);
        return () => ipcRenderer.removeListener("window:moved", listener);
      },
      onMaximized: (callback: (maximized: boolean) => void) => {
        const listener = (_: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
        ipcRenderer.on("window:maximized", listener);
        return () => ipcRenderer.removeListener("window:maximized", listener);
      },
      getPosition: (windowId: number) => betterIpcRenderer.invoke("window:getPosition", windowId),
      setPosition: (windowId: number, x: number, y: number) =>
        betterIpcRenderer.invoke("window:setPosition", windowId, x, y),
      getSize: (windowId: number) => betterIpcRenderer.invoke("window:getSize", windowId),
      setSize: (windowId: number, width: number, height: number) =>
        betterIpcRenderer.invoke("window:setSize", windowId, width, height),
      isVisible: (windowId: number) => betterIpcRenderer.invoke("window:isVisible", windowId),
      toggleDevTools: (windowId: number) =>
        betterIpcRenderer.invoke("window:toggleDevTools", windowId),
    },
    menu: {
      onMenuClick: (callback: (menuItemId: string) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, menuItemId: string) =>
          callback(menuItemId);
        ipcRenderer.on("menu:click", listener);
        return () => ipcRenderer.removeListener("menu:click", listener);
      },
      setApplicationMenu: (template) =>
        betterIpcRenderer.invoke("menu:setApplicationMenu", template),
    },
    contentTracing: {
      startRecording: (options) =>
        betterIpcRenderer.invoke("contentTracing:startRecording", options),
      stopRecording: (resultPath) =>
        betterIpcRenderer.invoke("contentTracing:stopRecording", resultPath),
    },
    redux: {
      getState: () => betterIpcRenderer.invoke("redux:getState"),
      getStateMsgpack: (idx?: number) => betterIpcRenderer.invoke("redux:getStateMsgpack", idx),
    },
    clipboard: {
      writeText: (text: string) => betterIpcRenderer.invoke("clipboard:writeText", text),
      readText: () => betterIpcRenderer.invoke("clipboard:readText"),
    },
    powerSaveBlocker: {
      start: (type) => betterIpcRenderer.invoke("powerSaveBlocker:start", type),
      stop: (id: number) => betterIpcRenderer.invoke("powerSaveBlocker:stop", id),
      isStarted: (id: number) => betterIpcRenderer.invoke("powerSaveBlocker:isStarted", id),
    },
    telemetry: {
      forwardSpan: (span) => betterIpcRenderer.send("telemetry:forward-span", span),
    },

    downloader: {
      start: (dest, collationId) => betterIpcRenderer.invoke("download:start", dest, collationId),
      pause: (downloadId) => betterIpcRenderer.invoke("download:pause", downloadId),
      resume: (checkpoint) => betterIpcRenderer.invoke("download:resume", checkpoint),
      cancel: (downloadId) => betterIpcRenderer.invoke("download:cancel", downloadId),
      getState: (downloadId) => betterIpcRenderer.invoke("download:getState", downloadId),
      getStates: (downloadIds) => betterIpcRenderer.invoke("download:getStates", downloadIds),
      configure: (options) => betterIpcRenderer.invoke("download:configure", options),
      // A rejection here propagates back to main so download:start rejects
      // immediately with the real reason instead of waiting out the callback
      // timeout. Cancellation rejects too, but the install manager drops
      // aborted downloads, so it won't be reported as a failure.
      onResolve: (handler) => betterIpcRenderer.callback("download:resolve", handler),
    },

    diag: {
      // Raw ipcRenderer because betterIpcRenderer has no sendSync helper.
      fatal: (message: string) => {
        try {
          ipcRenderer.sendSync("diag:fatal", message);
        } catch {
          // diagnostic must never throw
        }
      },
    },

    featureFlags: {
      onSynchronize: (callback) => {
        const listener = (_: Electron.IpcRendererEvent, flags: Parameters<typeof callback>[0]) =>
          callback(flags);
        ipcRenderer.on("flags:synchronize", listener);
        return () => ipcRenderer.removeListener("flags:synchronize", listener);
      },
      reportMetrics: (bucket) => betterIpcRenderer.send("flags:metrics", bucket),
      setContext: (context) => betterIpcRenderer.send("flags:setContext", context),
    },
  });
} catch (err) {
  console.error("failed to run preload code", err);
}

function expose<K extends keyof PreloadWindow>(key: K, value: PreloadWindow[K]) {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld(key, value);
  } else {
    // NOTE(erri120): This looks bad but sadly is correct.
    // When context isolation is disabled, contextBridge becomes unusable
    // so we have to manually set values on the window directly.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    (window as unknown as PreloadWindow)[key] = value;
  }
}

async function rendererInvoke<C extends keyof InvokeChannels>(
  channel: C,
  ...args: SerializableArgs<Parameters<InvokeChannels[C]>>
): Promise<AssertSerializable<Awaited<ReturnType<InvokeChannels[C]>>>> {
  const reply = await ipcRenderer.invoke(channel, ...args);
  if (isWireResult<AssertSerializable<Awaited<ReturnType<InvokeChannels[C]>>>>(reply)) {
    if (reply.ok) return reply.value;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    throw rehydrateSerializedError(reply.error as unknown as SerializedError, errorOriginTracker);
  }

  return reply;
}

function isWireResult<T>(value: unknown): value is WireResult<T> {
  return (
    typeof value === "object" && value !== null && "ok" in value && typeof value.ok === "boolean"
  );
}

function rendererSend<C extends keyof RendererChannels>(
  channel: C,
  ...args: SerializableArgs<Parameters<RendererChannels[C]>>
): void {
  ipcRenderer.send(channel, ...args);
}

function rendererOn<C extends keyof MainChannels>(
  channel: C,
  listener: (
    event: Electron.IpcRendererEvent,
    ...args: SerializableArgs<Parameters<MainChannels[C]>>
  ) => void,
): void {
  ipcRenderer.on(channel, listener);
}

function rendererOff<C extends keyof MainChannels>(
  channel: C,
  listener: (
    event: Electron.IpcRendererEvent,
    ...args: SerializableArgs<Parameters<MainChannels[C]>>
  ) => void,
): void {
  ipcRenderer.off(channel, listener);
}

// Registers a handler for a callback channel. Main sends a request on `channel`
// with a collation id; the handler produces (or rejects with) a value, which is
// sent back on `callback:${channel}` wrapped in a WireCallbackResult. Rejections
// are serialized so main can rehydrate the real error instead of waiting out the
// callback timeout. Returns an unsubscribe function. This is the renderer-side
// counterpart to betterIpcMain.callback.
function rendererCallback<C extends keyof CallbackChannels>(
  channel: C,
  handler: (
    collationId: number,
    ...args: SerializableArgs<Parameters<CallbackChannels[C]>>
  ) => Promise<Awaited<ReturnType<CallbackChannels[C]>>>,
): () => void {
  const listener = (
    _event: Electron.IpcRendererEvent,
    collationId: number,
    ...args: SerializableArgs<Parameters<CallbackChannels[C]>>
  ) => {
    handler(collationId, ...args)
      .then((value) => {
        ipcRenderer.send(`callback:${channel}`, collationId, {
          ok: true,
          value,
        });
        return undefined;
      })
      .catch((err: unknown) => {
        ipcRenderer.send(`callback:${channel}`, collationId, {
          ok: false,
          error: serializeError(err, errorOriginTracker),
        });
      });
  };
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
