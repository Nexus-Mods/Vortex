import { VortexError } from "@vortex/shared";
import { deserializeVortexError, UserCanceled } from "@vortex/shared/errors";
import type { WireReply } from "@vortex/shared/ipc";
import { assert, describe, it, expect, vi, beforeEach } from "vitest";

type InvokeHandler = (
  event: Electron.IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<WireReply<string>>;

// Capture the handler registered via ipcMain.handle so the test can invoke it
// directly and inspect the envelope it returns.
const handlers = new Map<string, InvokeHandler>();

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, fn: InvokeHandler) => {
      handlers.set(channel, fn);
    },
  },
}));

vi.mock("./logging", () => ({ log: vi.fn() }));

import { betterIpcMain } from "./ipc";

// A falsy senderFrame short-circuits assertTrustedSender as trusted, so the test
// doesn't need to mock the full trusted-sender plumbing.
const trustedEvent = {
  senderFrame: null,
} as unknown as Electron.IpcMainInvokeEvent;

async function callHandler(channel: string): Promise<WireReply<string>> {
  const fn = handlers.get(channel);
  if (fn === undefined) throw new Error(`no handler registered for ${channel}`);
  return fn(trustedEvent);
}

describe("betterIpcMain.handle envelope", () => {
  beforeEach(() => handlers.clear());

  it("wraps a successful result in a { data } envelope", async () => {
    betterIpcMain.handle("app:getName", () => "vortex");

    const result = await callHandler("app:getName");
    assert(result.error === undefined);
    expect(result.data).toBe("vortex");
  });

  it("serializes a thrown UserCanceled into a VortexError wire form", async () => {
    // UserCanceled is a compat class that extends VortexError<"user-canceled">;
    // the boundary entry point passes it through, so the wire form carries
    // `kind: "user-canceled"` directly (no double-nesting under a generic
    // `data` bag). The renderer branches on data.kind.
    betterIpcMain.handle("app:getName", () => {
      throw new UserCanceled();
    });

    const result = await callHandler("app:getName");
    assert(result.error !== undefined);

    expect(result.error.message).toBe("canceled by user");
    expect(result.error.data.kind).toBe("user-canceled");

    const rehydrated = deserializeVortexError(result.error);
    expect(rehydrated).toBeInstanceOf(VortexError);
    expect(rehydrated.data.kind).toBe("user-canceled");
  });

  it("preserves error.kind across the envelope (for VortexError branch checks)", async () => {
    // Regression: a VortexError thrown across the invoke boundary must round-trip
    // with its discriminator intact so the renderer can branch on data.kind.
    betterIpcMain.handle("app:getName", () => {
      throw new VortexError("Download cancelled", { kind: "user-canceled", skipped: false });
    });

    const result = await callHandler("app:getName");
    assert(result.error !== undefined);

    expect(result.error.message).toBe("Download cancelled");
    expect(result.error.data).toMatchObject({ kind: "user-canceled" });

    const rehydrated = deserializeVortexError(result.error);
    expect(rehydrated).toBeInstanceOf(VortexError);
    expect(rehydrated.data.kind).toBe("user-canceled");
  });
});
