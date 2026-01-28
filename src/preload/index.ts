import { contextBridge, ipcRenderer } from "electron";
import type { PreloadWindow } from "@shared/types/preload";
import type {
  RendererChannels,
  InvokeChannels,
  MainChannels,
  SerializableArgs,
  AssertSerializable,
} from "@shared/types/ipc";

// NOTE(erri120): Welcome to the preload script. This is the correct and safe place to expose data and methods to the renderer. Here are a few rules and tips to make your life easier:
// 1) Never expose anything electron related to the renderer. This is what the preload script is for.
// 2) Use betterIpcRenderer defined below instead of raw ipcRenderer.

const betterIpcRenderer = {
  invoke: rendererInvoke,
  send: rendererSend,
  on: rendererOn,
};

try {
  expose("versions", {
    chromium: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  });

  expose("api", {
    example: {
      ping: () => betterIpcRenderer.invoke("example:ping"),
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
