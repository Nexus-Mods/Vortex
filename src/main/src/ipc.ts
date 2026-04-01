import type {
  RendererChannels,
  MainChannels,
  InvokeChannels,
  SyncChannels,
} from "@vortex/shared/ipc";

import { ipcMain, type WebContents } from "electron";

import { log } from "./logging";

export const betterIpcMain = {
  on: mainOn,
  handle: mainHandle,
  handleSync: mainHandleSync,
  send: mainSend,
};

export type LogOptions = boolean | { includeArgs: boolean };
type IpcArgs<F> = F extends (...args: infer A) => unknown ? A : never;
type IpcResult<F> = F extends (...args: any[]) => infer R ? Awaited<R> : never;

function ipcLogger(
  options: LogOptions,
  channel: string,
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
  args: readonly unknown[],
): void {
  if (!options) return;

  const { senderFrame } = event;
  const url = senderFrame?.url ?? event.sender.mainFrame.url;

  let jsonArgs: string | undefined = undefined;
  if (typeof options === "object" && options.includeArgs) {
    jsonArgs = JSON.stringify(args);
  }

  log("debug", "IPC main event", {
    channel: channel,
    sender: url,
    args: jsonArgs,
  });
}

function mainOn<C extends keyof RendererChannels>(
  channel: C,
  listener: (
    event: Electron.IpcMainEvent,
    ...args: IpcArgs<RendererChannels[C]>
  ) => void,
  logOptions: LogOptions = false,
): void {
  ipcMain.on(
    channel,
    (event, ...args: IpcArgs<RendererChannels[C]>) => {
      ipcLogger(logOptions, channel, event, args);
      assertTrustedSender(event);
      listener(event, ...args);
    },
  );
}

function mainHandle<C extends keyof InvokeChannels>(
  channel: C,
  listener: (
    event: Electron.IpcMainInvokeEvent,
    ...args: IpcArgs<InvokeChannels[C]>
  ) => Promise<IpcResult<InvokeChannels[C]>> | IpcResult<InvokeChannels[C]>,
  logOptions: LogOptions = false,
): void {
  ipcMain.handle(
    channel,
    (event, ...args: IpcArgs<InvokeChannels[C]>) => {
      ipcLogger(logOptions, channel, event, args);
      assertTrustedSender(event);
      return listener(event, ...args);
    },
  );
}

function mainHandleSync<C extends keyof SyncChannels>(
  channel: C,
  listener: (
    event: Electron.IpcMainEvent,
    ...args: IpcArgs<SyncChannels[C]>
  ) => ReturnType<SyncChannels[C]>,
): void {
  ipcMain.on(
    channel,
    (event, ...args: IpcArgs<SyncChannels[C]>) => {
      assertTrustedSender(event);
      event.returnValue = listener(event, ...args);
    },
  );
}

function mainSend<C extends keyof MainChannels>(
  webContents: WebContents,
  channel: C,
  ...args: IpcArgs<MainChannels[C]>
): void {
  webContents.send(channel, ...args);
}

function assertTrustedSender(
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
) {
  // NOTE(erri120): https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages

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

  // TODO: use custom protocol https://www.electronjs.org/docs/latest/tutorial/security#18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols

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
