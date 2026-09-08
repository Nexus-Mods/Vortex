// Renderer-side IPC helpers exposed to the preload script as `betterIpcRenderer`.
// Lives in its own module so the envelope logic can be exercised by tests
// without importing `index.ts`'s top-level `expose()` side effects (which need
// a full Electron context to evaluate).

import { VortexError } from "@vortex/shared";
import type { ErrorOriginTracker } from "@vortex/shared/errors";
import { deserializeVortexError, toWireError } from "@vortex/shared/errors";
import type {
  RendererChannels,
  InvokeChannels,
  MainChannels,
  CallbackChannels,
  SerializableArgs,
  AssertSerializable,
  WireReply,
} from "@vortex/shared/ipc";
import { ipcRenderer } from "electron";

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
const originStash = new Map<string, VortexError>();
let originSeq = 0;
export const errorOriginTracker: ErrorOriginTracker = {
  namespace: "renderer",
  capture: (err) => {
    const id = `${originSeq++}`;
    originStash.set(id, err);
    if (originStash.size > ORIGIN_STASH_MAX) {
      const oldest = originStash.keys().next().value;
      if (oldest !== undefined) originStash.delete(oldest);
    }
    return id;
  },
  resolve: (id) => {
    const err = originStash.get(id);
    if (err !== undefined) originStash.delete(id);
    return err;
  },
};

export async function rendererInvoke<C extends keyof InvokeChannels>(
  channel: C,
  ...args: SerializableArgs<Parameters<InvokeChannels[C]>>
): Promise<AssertSerializable<Awaited<ReturnType<InvokeChannels[C]>>>> {
  const reply: WireReply<AssertSerializable<Awaited<ReturnType<InvokeChannels[C]>>>> =
    await ipcRenderer.invoke(channel, ...args);
  if (reply.error) {
    throw deserializeVortexError(reply.error, errorOriginTracker);
  } else {
    return reply.data;
  }
}

export function rendererSend<C extends keyof RendererChannels>(
  channel: C,
  ...args: SerializableArgs<Parameters<RendererChannels[C]>>
): void {
  ipcRenderer.send(channel, ...args);
}

export function rendererOn<C extends keyof MainChannels>(
  channel: C,
  listener: (
    event: Electron.IpcRendererEvent,
    ...args: SerializableArgs<Parameters<MainChannels[C]>>
  ) => void,
): void {
  ipcRenderer.on(channel, listener);
}

export function rendererOff<C extends keyof MainChannels>(
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
export function rendererCallback<C extends keyof CallbackChannels>(
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
        const reply: WireReply<typeof value> = { data: value };
        ipcRenderer.send(`callback:${channel}`, collationId, reply);
        return undefined;
      })
      .catch((err: unknown) => {
        const reply: WireReply<unknown> = { error: toWireError(err) };
        ipcRenderer.send(`callback:${channel}`, collationId, reply);
      });
  };

  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
