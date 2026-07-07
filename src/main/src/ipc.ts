import { rehydrateSerializedError, serializeError } from "@vortex/shared";
import type {
  RendererChannels,
  MainChannels,
  InvokeChannels,
  SerializableArgs,
  AssertSerializable,
  CallbackChannels,
  MainCallbackChannels,
  SerializedError,
} from "@vortex/shared/ipc";
import { ipcMain, type WebContents } from "electron";

import { log } from "./logging";

export const betterIpcMain = {
  on: mainOn,
  handle: mainHandle,
  send: mainSend,
  callback: mainCallback,
};

export type LogOptions = boolean | { includeArgs: boolean };

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
    ...args: SerializableArgs<Parameters<RendererChannels[C]>>
  ) => void,
  logOptions: LogOptions = false,
): () => void {
  const outerListener = (
    event: Electron.IpcMainEvent,
    ...args: SerializableArgs<Parameters<RendererChannels[C]>>
  ) => {
    ipcLogger(logOptions, channel, event, args);
    assertTrustedSender(event);
    listener(event, ...args);
  };

  ipcMain.on(channel, outerListener);
  return () => ipcMain.off(channel, outerListener);
}

function mainCallback<C extends keyof CallbackChannels>(
  channel: C,
  webContents: WebContents,
  timeout: number,
  ...args: SerializableArgs<Parameters<MainCallbackChannels[C]>>
): Promise<AssertSerializable<Awaited<ReturnType<CallbackChannels[C]>>>> {
  const collationId = args[0];

  let resolve:
    | ((value: AssertSerializable<Awaited<ReturnType<CallbackChannels[C]>>>) => void)
    | undefined = undefined;
  let reject: ((reason?: Error) => void) | undefined = undefined;

  const promise = new Promise<AssertSerializable<Awaited<ReturnType<CallbackChannels[C]>>>>(
    (res, rej) => {
      resolve = res;
      reject = rej;
    },
  );

  const settle = () => {
    resolve = undefined;
    reject = undefined;
  };

  // A non-positive timeout disables the wall-clock deadline (used by
  // download:resolve - see downloading/ipc.ts). The renderer always settles the
  // callback (resolve on success, reject on cancel/skip, network calls carry
  // their own timeouts), so the only failure mode left to guard against is the
  // renderer dying, handled by the destroyed listener below.
  const timer =
    timeout > 0
      ? setTimeout(() => {
          if (reject) {
            const rej = reject;
            settle();
            rej(new Error(`Callback for channel '${channel}' timed out after ${timeout}ms`));
          }
        }, timeout)
      : undefined;

  const onDestroyed = () => {
    if (reject) {
      const rej = reject;
      settle();
      rej(new Error(`Callback for channel '${channel}' aborted: renderer was destroyed`));
    }
  };
  webContents.once("destroyed", onDestroyed);

  const off = mainOn(`callback:${channel}`, (event, ...args) => {
    const { sender } = event;
    if (sender.id !== webContents.id) return;

    const receivedCollationId = args[0];
    if (receivedCollationId !== collationId) return;

    // The timer or destroyed listener may already have settled this promise; bail if so.
    if (resolve === undefined || reject === undefined) return;
    const res = resolve;
    const rej = reject;
    resolve = undefined;
    reject = undefined;

    const result = args[1] as unknown as
      | { ok: true; value: unknown }
      | { ok: false; error: SerializedError };
    if ("error" in result) {
      rej(rehydrateSerializedError(result.error));
    } else {
      res(result.value as AssertSerializable<Awaited<ReturnType<CallbackChannels[C]>>>);
    }
  });

  mainSend(webContents, channel, ...args);
  return promise.finally(() => {
    off();
    if (timer !== undefined) clearTimeout(timer);
    webContents.off("destroyed", onDestroyed);
  });
}

function mainHandle<C extends keyof InvokeChannels>(
  channel: C,
  listener: (
    event: Electron.IpcMainInvokeEvent,
    ...args: SerializableArgs<Parameters<InvokeChannels[C]>>
  ) =>
    | Promise<AssertSerializable<Awaited<ReturnType<InvokeChannels[C]>>>>
    | AssertSerializable<Awaited<ReturnType<InvokeChannels[C]>>>,
  logOptions: LogOptions = false,
): void {
  ipcMain.handle(
    channel,
    async (event, ...args: SerializableArgs<Parameters<InvokeChannels[C]>>) => {
      ipcLogger(logOptions, channel, event, args);
      try {
        assertTrustedSender(event);
        const value = await listener(event, ...args);
        return { ok: true, value };
      } catch (err) {
        return { ok: false, error: serializeError(err) };
      }
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

function assertTrustedSender(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  // NOTE(erri120): https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages

  const { senderFrame } = event;
  if (!senderFrame) return;

  const rawUrl = senderFrame.url;
  const url = parseURL(rawUrl);
  if (!url) throw new Error(`Invalid url: ${rawUrl}`);

  if (!isTrustedProtocol(url)) throw new Error(`URL is not a trusted protocol: ${rawUrl}`);
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
