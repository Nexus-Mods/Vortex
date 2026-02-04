import type {
  DiffOperation,
  PersistedHive,
  AppInitMetadata,
  RendererChannels,
  InvokeChannels,
  MainChannels,
  SerializableArgs,
  AssertSerializable,
  Serializable,
} from "@shared/types/ipc";
import type { PreloadWindow } from "@shared/types/preload";

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

    example: {
      ping: () => betterIpcRenderer.invoke("example:ping"),
    },

    persist: {
      sendDiff: (hive: PersistedHive, operations: DiffOperation[]) =>
        betterIpcRenderer.send("persist:diff", hive, operations),

      getHydration: () => betterIpcRenderer.invoke("persist:get-hydration"),

      onHydrate: (
        callback: (hive: PersistedHive, data: Serializable) => void,
      ) =>
        betterIpcRenderer.on("persist:hydrate", (_, hive, data) =>
          callback(hive, data),
        ),
    },

    window: {
      onResized: (callback: (width: number, height: number) => void) =>
        betterIpcRenderer.on("window:resized", (_, width, height) =>
          callback(width, height),
        ),

      onMoved: (callback: (x: number, y: number) => void) =>
        betterIpcRenderer.on("window:moved", (_, x, y) => callback(x, y)),

      onMaximized: (callback: (maximized: boolean) => void) =>
        betterIpcRenderer.on("window:maximized", (_, maximized) =>
          callback(maximized),
        ),
    },

    app: {
      onInit: (callback: (metadata: AppInitMetadata) => void) =>
        betterIpcRenderer.on("app:init", (_, metadata) => callback(metadata)),
    },

    extensions: {
      initializeAllMain: (installType: string) =>
        betterIpcRenderer.send("extensions:init-all-main", installType),

      requestMainInit: (extensionName: string) =>
        new Promise<{ success: boolean; error?: string }>((resolve) => {
          // Set up one-time response listener
          const responseHandler = (
            _: Electron.IpcRendererEvent,
            response: {
              extensionName: string;
              success: boolean;
              error?: string;
            },
          ) => {
            if (response.extensionName === extensionName) {
              betterIpcRenderer.off(
                "extensions:init-main-response",
                responseHandler,
              );
              resolve(response);
            }
          };
          betterIpcRenderer.on(
            "extensions:init-main-response",
            responseHandler,
          );

          // Send the request
          betterIpcRenderer.send("extensions:init-main", extensionName);
        }),
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
