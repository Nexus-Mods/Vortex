import type {
  AppInitMetadata,
  RendererChannels,
  InvokeChannels,
  MainChannels,
  SerializableArgs,
  AssertSerializable,
  Serializable,
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

    compileStylesheets: (filePaths) =>
      betterIpcRenderer.invoke("styles:compile", filePaths),

    example: {
      ping: () => betterIpcRenderer.invoke("example:ping"),
    },

    shell: {
      openUrl: (url) => betterIpcRenderer.send("shell:openUrl", url),
      openFile: (filePath) =>
        betterIpcRenderer.send("shell:openFile", filePath),
    },

    persist: {
      sendDiff: (hive, operations) =>
        betterIpcRenderer.send("persist:diff", hive, operations),

      getHydration: () => betterIpcRenderer.invoke("persist:get-hydration"),

      onHydrate: (
        callback: (hive: PersistedHive, data: Serializable) => void,
      ) =>
        betterIpcRenderer.on("persist:hydrate", (_, hive, data) =>
          callback(hive, data),
        ),
    },

    extensions: {
      initializeAllMain: (installType: string) =>
        betterIpcRenderer.send("extensions:init-all-main", installType),
    },

    updater: {
      getStatus: () => betterIpcRenderer.invoke("updater:get-status"),
      setChannel: (channel: string, manual: boolean) =>
        betterIpcRenderer.send("updater:set-channel", channel, manual),
      checkForUpdates: (channel: string, manual: boolean) =>
        betterIpcRenderer.send("updater:check-for-updates", channel, manual),
      downloadUpdate: (
        channel: string,
        installAfterDownload: boolean = false,
      ) =>
        betterIpcRenderer.send(
          "updater:download",
          channel,
          installAfterDownload,
        ),
      restartAndInstall: () =>
        betterIpcRenderer.send("updater:restart-and-install"),
    },

    dialog: {
      showOpen: (options) =>
        betterIpcRenderer.invoke("dialog:showOpen", options),
      showSave: (options) =>
        betterIpcRenderer.invoke("dialog:showSave", options),
      showMessageBox: (options) =>
        betterIpcRenderer.invoke("dialog:showMessageBox", options),
      showErrorBox: (title, content) =>
        betterIpcRenderer.invoke("dialog:showErrorBox", title, content),
    },
    app: {
      relaunch: (args) => betterIpcRenderer.send("app:relaunch", args),
      onInit: (callback: (metadata: AppInitMetadata) => void) =>
        betterIpcRenderer.on("app:init", (_, metadata) => callback(metadata)),
      setProtocolClient: (protocol: string, udPath: string) =>
        betterIpcRenderer.invoke("app:setProtocolClient", protocol, udPath),
      isProtocolClient: (protocol: string, udPath: string) =>
        betterIpcRenderer.invoke("app:isProtocolClient", protocol, udPath),
      removeProtocolClient: (protocol: string, udPath: string) =>
        betterIpcRenderer.invoke("app:removeProtocolClient", protocol, udPath),
      exit: (exitCode: number) =>
        betterIpcRenderer.invoke("app:exit", exitCode),
      getName: () => betterIpcRenderer.invoke("app:getName"),
      getPath: (name: string) => betterIpcRenderer.invoke("app:getPath", name),
      setPath: (name: string, value: string) =>
        betterIpcRenderer.invoke("app:setPath", name, value),
      extractFileIcon: (exePath: string, iconPath: string) =>
        betterIpcRenderer.invoke("app:extractFileIcon", exePath, iconPath),
      setJumpList: (categories) =>
        betterIpcRenderer.invoke("app:setJumpList", categories),
      setLoginItemSettings: (settings) =>
        betterIpcRenderer.invoke("app:setLoginItemSettings", settings),
      getLoginItemSettings: () =>
        betterIpcRenderer.invoke("app:getLoginItemSettings"),
      getAppPath: () => betterIpcRenderer.invoke("app:getAppPath"),
      getVersion: () => betterIpcRenderer.invoke("app:getVersion"),
      getVortexPaths: () => betterIpcRenderer.invoke("app:getVortexPaths"),
    },
    browserView: {
      create: (src: string, partition: string, isNexus: boolean) =>
        betterIpcRenderer.invoke("browserView:create", src, partition, isNexus),
      createWithEvents: (src, forwardEvents, options) =>
        betterIpcRenderer.invoke(
          "browserView:createWithEvents",
          src,
          forwardEvents,
          options,
        ),
      close: (viewId: string) =>
        betterIpcRenderer.invoke("browserView:close", viewId),
      position: (viewId: string, rect: Electron.Rectangle) =>
        betterIpcRenderer.invoke("browserView:position", viewId, rect),
      updateURL: (viewId: string, newURL: string) =>
        betterIpcRenderer.invoke("browserView:updateURL", viewId, newURL),
    },
    session: {
      getCookies: (filter) =>
        betterIpcRenderer.invoke("session:getCookies", filter),
    },
    window: {
      getId: () => betterIpcRenderer.invoke("window:getId"),
      minimize: (windowId: number) =>
        betterIpcRenderer.invoke("window:minimize", windowId),
      maximize: (windowId: number) =>
        betterIpcRenderer.invoke("window:maximize", windowId),
      unmaximize: (windowId: number) =>
        betterIpcRenderer.invoke("window:unmaximize", windowId),
      restore: (windowId: number) =>
        betterIpcRenderer.invoke("window:restore", windowId),
      close: (windowId: number) =>
        betterIpcRenderer.invoke("window:close", windowId),
      focus: (windowId: number) =>
        betterIpcRenderer.invoke("window:focus", windowId),
      show: (windowId: number) =>
        betterIpcRenderer.invoke("window:show", windowId),
      hide: (windowId: number) =>
        betterIpcRenderer.invoke("window:hide", windowId),
      isMaximized: (windowId: number) =>
        betterIpcRenderer.invoke("window:isMaximized", windowId),
      isMinimized: (windowId: number) =>
        betterIpcRenderer.invoke("window:isMinimized", windowId),
      isFocused: (windowId: number) =>
        betterIpcRenderer.invoke("window:isFocused", windowId),
      setAlwaysOnTop: (windowId: number, flag: boolean) =>
        betterIpcRenderer.invoke("window:setAlwaysOnTop", windowId, flag),
      moveTop: (windowId: number) =>
        betterIpcRenderer.invoke("window:moveTop", windowId),
      onMaximize: (callback) => {
        const listener = () => callback();
        ipcRenderer.on("window:event:maximize", listener);
        return () =>
          ipcRenderer.removeListener("window:event:maximize", listener);
      },
      onUnmaximize: (callback) => {
        const listener = () => callback();
        ipcRenderer.on("window:event:unmaximize", listener);
        return () =>
          ipcRenderer.removeListener("window:event:unmaximize", listener);
      },
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
        const listener = (
          _: Electron.IpcRendererEvent,
          width: number,
          height: number,
        ) => callback(width, height);
        ipcRenderer.on("window:resized", listener);
        return () => ipcRenderer.removeListener("window:resized", listener);
      },
      onMoved: (callback: (x: number, y: number) => void) => {
        const listener = (_: Electron.IpcRendererEvent, x: number, y: number) =>
          callback(x, y);
        ipcRenderer.on("window:moved", listener);
        return () => ipcRenderer.removeListener("window:moved", listener);
      },
      onMaximized: (callback: (maximized: boolean) => void) => {
        const listener = (_: Electron.IpcRendererEvent, maximized: boolean) =>
          callback(maximized);
        ipcRenderer.on("window:maximized", listener);
        return () => ipcRenderer.removeListener("window:maximized", listener);
      },
      getPosition: (windowId: number) =>
        betterIpcRenderer.invoke("window:getPosition", windowId),
      setPosition: (windowId: number, x: number, y: number) =>
        betterIpcRenderer.invoke("window:setPosition", windowId, x, y),
      getSize: (windowId: number) =>
        betterIpcRenderer.invoke("window:getSize", windowId),
      setSize: (windowId: number, width: number, height: number) =>
        betterIpcRenderer.invoke("window:setSize", windowId, width, height),
      isVisible: (windowId: number) =>
        betterIpcRenderer.invoke("window:isVisible", windowId),
      toggleDevTools: (windowId: number) =>
        betterIpcRenderer.invoke("window:toggleDevTools", windowId),
    },
    menu: {
      onMenuClick: (callback: (menuItemId: string) => void) => {
        const listener = (
          _event: Electron.IpcRendererEvent,
          menuItemId: string,
        ) => callback(menuItemId);
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
      getStateMsgpack: (idx?: number) =>
        betterIpcRenderer.invoke("redux:getStateMsgpack", idx),
    },
    clipboard: {
      writeText: (text: string) =>
        betterIpcRenderer.invoke("clipboard:writeText", text),
      readText: () => betterIpcRenderer.invoke("clipboard:readText"),
    },
    powerSaveBlocker: {
      start: (type) => betterIpcRenderer.invoke("powerSaveBlocker:start", type),
      stop: (id: number) =>
        betterIpcRenderer.invoke("powerSaveBlocker:stop", id),
      isStarted: (id: number) =>
        betterIpcRenderer.invoke("powerSaveBlocker:isStarted", id),
    },
  });
} catch (err) {
  console.error("failed to run preload code", err);
}

function expose<K extends keyof PreloadWindow>(
  key: K,
  value: PreloadWindow[K],
) {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld(key, value);
  } else {
    // NOTE(erri120): This looks bad but sadly is correct.
    // When context isolation is disabled, contextBridge becomes unusable
    // so we have to manually set values on the window directly.
    (window as unknown as PreloadWindow)[key] = value;
  }
}

function rendererInvoke<C extends keyof InvokeChannels>(
  channel: C,
  ...args: SerializableArgs<Parameters<InvokeChannels[C]>>
): Promise<AssertSerializable<Awaited<ReturnType<InvokeChannels[C]>>>> {
  return ipcRenderer.invoke(channel, ...args);
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
