import { rehydrateSerializedError } from "@vortex/shared";
import { DownloadError, UserCanceled, isErrorOfType } from "@vortex/shared/errors";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Match rehydrateSerializedError's own parameter type so the round-trip below
// uses a single, consistent SerializedError declaration.
type SerializedError = Parameters<typeof rehydrateSerializedError>[0];

// The WireResult envelope betterIpcMain.handle wraps every reply in.
type Envelope = { ok: true; value: unknown } | { ok: false; error: SerializedError };

type InvokeHandler = (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<Envelope>;

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

async function callHandler(channel: string): Promise<Envelope> {
  const fn = handlers.get(channel);
  if (fn === undefined) throw new Error(`no handler registered for ${channel}`);
  return fn(trustedEvent);
}

describe("betterIpcMain.handle envelope", () => {
  beforeEach(() => handlers.clear());

  it("wraps a successful result in an ok envelope", async () => {
    betterIpcMain.handle("app:getName", () => "vortex");

    const result = await callHandler("app:getName");

    expect(result).toEqual({ ok: true, value: "vortex" });
  });

  it("serializes a thrown UserCanceled so it round-trips with its type intact", async () => {
    // Regression: errors thrown across the invoke boundary used to be flattened
    // by Electron to a generic `Error` (name "Error"), so the renderer's
    // isErrorOfType(err, UserCanceled) gate failed and cancellations leaked into
    // telemetry. The envelope must carry the name so rehydration restores it.
    betterIpcMain.handle("app:getName", () => {
      throw new UserCanceled();
    });

    const result = await callHandler("app:getName");
    if (!("error" in result)) throw new Error("expected failure envelope");

    expect(result.error.name).toBe("UserCanceled");

    // The renderer side rehydrates the serialized error before throwing it.
    const rehydrated = rehydrateSerializedError(result.error);
    expect(rehydrated.name).toBe("UserCanceled");
    expect(isErrorOfType(rehydrated, UserCanceled)).toBe(true);
  });

  it("preserves error.code across the envelope (for isEnvironmentalError checks)", async () => {
    betterIpcMain.handle("app:getName", () => {
      throw new DownloadError({ code: "cancellation" }, "Download cancelled");
    });

    const result = await callHandler("app:getName");
    if (!("error" in result)) throw new Error("expected failure envelope");

    expect(result.error.name).toBe("DownloadError");
    expect(result.error.code).toBe("cancellation");

    const rehydrated = rehydrateSerializedError(result.error);
    expect(isErrorOfType(rehydrated, DownloadError)).toBe(true);
    expect((rehydrated as Error & { code?: string }).code).toBe("cancellation");
  });
});
