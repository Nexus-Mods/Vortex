import type {
  RendererChannels,
  MainChannels,
  InvokeChannels,
  SerializableArgs,
  AssertSerializable,
} from "@shared/types/ipc.js";

import { ipcMain, type WebContents } from "electron";

export const betterIpcMain = {
  on: mainOn,
  handle: mainHandle,
  send: mainSend,
};

export type LogOptions = boolean | { includeArgs: boolean };

function log(
  options: LogOptions,
  channel: string,
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
  args: readonly unknown[],
): void {
  if (!options) return;

  const { senderFrame } = event;
  const url = senderFrame?.url ?? event.sender.mainFrame.url;

  if (typeof options === "object" && options.includeArgs) {
    const jsonArgs = JSON.stringify(args);
    console.debug(
      `IPC main event on channel '${channel}' with args '${jsonArgs}' from sender '${url}'`,
    );
  } else {
    console.debug(
      `IPC main event on channel '${channel}' from sender '${url}'`,
    );
  }
}

function mainOn<C extends keyof RendererChannels>(
  channel: C,
  listener: (
    event: Electron.IpcMainEvent,
    ...args: SerializableArgs<Parameters<RendererChannels[C]>>
  ) => void,
  logOptions: LogOptions = false
): void {
  ipcMain.on(
    channel,
    (event, ...args: SerializableArgs<Parameters<RendererChannels[C]>>) => {
      log(logOptions, channel, event, args);
      assertTrustedSender(event);
      listener(event, ...args);
    },
  );
}

function mainHandle<C extends keyof InvokeChannels>(
  channel: C,
  listener: (
    event: Electron.IpcMainInvokeEvent,
    ...args: SerializableArgs<Parameters<InvokeChannels[C]>>
  ) => Promise<AssertSerializable<Awaited<ReturnType<InvokeChannels[C]>>>>,
  logOptions: LogOptions = false
): void {
  ipcMain.handle(
    channel,
    (event, ...args: SerializableArgs<Parameters<InvokeChannels[C]>>) => {
      log(logOptions, channel, event, args);
      assertTrustedSender(event);
      return listener(event, ...args);
    },
  );
}

function mainSend<C extends keyof MainChannels>(
  webContents: WebContents,
  channel: C,
  ...args: SerializableArgs<Parameters<MainChannels[C]>>
): void {
  webContents.send(channel, ...args);
}

function assertTrustedSender(
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
) {
  const { senderFrame } = event;
  if (!senderFrame) return;

  const rawUrl = senderFrame.url;
  const url = parseURL(rawUrl);
  if (!url) throw new Error(`Invalid url: ${rawUrl}`);

  if (!isTrustedProtocol(url))
    throw new Error(`URL is not a trusted protocol: ${rawUrl}`);
}

function isTrustedProtocol(url: URL): boolean {
  const { protocol } = url;

  // trusted local files
  if (protocol === "file:") return true;

  // only trust http(s) for dev server
  if (protocol === "http:" || url.protocol === "https:") {
    return allowedHosts.has(url.hostname) && url.port !== "";
  }

  return false;
}

function parseURL(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

const allowedHosts = new Set(["localhost", "127.0.0.1", "::1/128"]);
