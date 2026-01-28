import { ipcMain, type WebContents } from "electron";
import type {
  RendererChannels,
  MainChannels,
  InvokeChannels,
  SerializableArgs,
  AssertSerializable,
} from "@shared/types/ipc.js";

export const betterIpcMain = {
  on: mainOn,
  handle: mainHandle,
  send: mainSend,
};

function mainOn<C extends keyof RendererChannels>(
  channel: C,
  listener: (
    event: Electron.IpcMainEvent,
    ...args: SerializableArgs<Parameters<RendererChannels[C]>>
  ) => void,
): void {
  ipcMain.on(
    channel,
    (event, ...args: SerializableArgs<Parameters<RendererChannels[C]>>) => {
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
): void {
  ipcMain.handle(
    channel,
    (event, ...args: SerializableArgs<Parameters<InvokeChannels[C]>>) => {
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
