import { VortexError } from "@vortex/shared";
import { toWireError } from "@vortex/shared/errors";
import { describe, expect, it, vi } from "vitest";

// Capture the listener registered via ipcRenderer.on so the test can invoke it
// directly with a mocked event and the args main would send.
type InvokeListener = (event: unknown, ...args: unknown[]) => void;
const invokeListeners = new Map<string, InvokeListener>();
type SendPayload = readonly unknown[];
const sentPayloads: Array<{ channel: string; args: SendPayload }> = [];

// Programmable invoke: the test sets `nextInvokeReply` to whatever the mocked
// ipcRenderer.invoke should resolve with.
let nextInvokeReply: unknown = undefined;

vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: vi.fn<() => Promise<unknown>>(async () => nextInvokeReply),
    on: (channel: string, listener: InvokeListener) => {
      invokeListeners.set(channel, listener);
    },
    send: (channel: string, ...args: unknown[]) => {
      sentPayloads.push({ channel, args });
    },
    removeListener: (channel: string, _listener: InvokeListener) => {
      invokeListeners.delete(channel);
    },
  },
}));

import { errorOriginTracker, rendererCallback, rendererInvoke } from "./ipc";

const fakeEvent = {};

// Build a wire form the way main would, going through the boundary entry
// point. This is the only way the test can produce a ref-tagged wire form
// without reaching into the serialization module's private ref key.
const buildWireError = (err: VortexError): unknown => toWireError(err, errorOriginTracker);

describe("rendererInvoke envelope", () => {
  it("resolves with the channel's value when the reply carries { data }", async () => {
    nextInvokeReply = { data: "vortex" };

    const value = await rendererInvoke("app:getName");

    expect(value).toBe("vortex");
  });

  it("rejects with a reconstructed VortexError when the reply carries { error }", async () => {
    const original = new VortexError("Download cancelled", {
      kind: "user-canceled",
      skipped: false,
    });
    nextInvokeReply = { error: buildWireError(original) };

    await expect(rendererInvoke("app:getName")).rejects.toBe(original);
  });

  it("rejects with a live VortexError preserving its identity and data", async () => {
    const original = new VortexError("nope", { kind: "data-invalid" });
    nextInvokeReply = { error: buildWireError(original) };

    await expect(rendererInvoke("app:getName")).rejects.toBe(original);
  });

  it("resolves with an object that happens to carry its own error field", async () => {
    // Under the pair envelope, only the top-level `error` is the failure
    // signal. A channel whose return value contains an `error` property
    // resolves with that object rather than throwing.
    const payload = { error: "downstream warning", code: 0 };
    nextInvokeReply = { data: payload };

    const value = await rendererInvoke("app:getName");

    expect(value).toEqual(payload);
  });
});

describe("rendererCallback envelope", () => {
  it("sends { data } on handler resolve", async () => {
    sentPayloads.length = 0;
    rendererCallback("example:ping", async (collationId, _ping) => {
      expect(typeof collationId).toBe("number");
      return { pong: "ok" };
    });
    const listener = invokeListeners.get("example:ping");
    if (listener === undefined) throw new Error("listener not registered");

    listener(fakeEvent, 7);
    // Drain microtasks: handler().then(...) fires ipcRenderer.send asynchronously.
    await new Promise((resolve) => setImmediate(resolve));

    expect(sentPayloads).toHaveLength(1);
    const entry = sentPayloads[0];
    if (entry === undefined) throw new Error("expected one sent payload");
    expect(entry.channel).toBe("callback:example:ping");
    expect(entry.args[0]).toBe(7);
    expect(entry.args[1]).toEqual({ data: { pong: "ok" } });
  });

  it("sends { error } carrying the VortexError wire form on handler reject", async () => {
    sentPayloads.length = 0;
    rendererCallback("example:ping", async (_collationId, _ping) => {
      throw new VortexError("cancelled", { kind: "user-canceled", skipped: false });
    });
    const listener = invokeListeners.get("example:ping");
    if (listener === undefined) throw new Error("listener not registered");

    listener(fakeEvent, 9);
    // Drain the rejection microtask chain (handler().then().catch(...)) before
    // asserting on the captured send payload.
    await new Promise((resolve) => setImmediate(resolve));

    expect(sentPayloads).toHaveLength(1);
    const entry = sentPayloads[0];
    if (entry === undefined) throw new Error("expected one sent payload");
    expect(entry.channel).toBe("callback:example:ping");
    expect(entry.args[0]).toBe(9);
    expect(entry.args[1]).toMatchObject({ error: { data: { kind: "user-canceled" } } });
  });

  it("coerces a non-VortexError throw into a VortexError wire form", async () => {
    // A plain Error thrown in the handler flows through parseError to a
    // VortexError (kind "unknown"); the wire form is sent on the callback
    // channel. The receiver gets a reconstructed VortexError rather than
    // a generic Error.
    sentPayloads.length = 0;
    rendererCallback("example:ping", async (_collationId, _ping) => {
      throw new Error("boom");
    });
    const listener = invokeListeners.get("example:ping");
    if (listener === undefined) throw new Error("listener not registered");

    listener(fakeEvent, 11);
    await new Promise((resolve) => setImmediate(resolve));

    expect(sentPayloads).toHaveLength(1);
    const entry = sentPayloads[0];
    if (entry === undefined) throw new Error("expected one sent payload");
    expect(entry.args[1]).toMatchObject({ error: { data: { kind: "unknown" } } });
  });
});
