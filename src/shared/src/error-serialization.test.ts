import { assert, describe, expect, it } from "vitest";

import { serializeError, rehydrateSerializedError } from "./error-serialization";
import { DownloadError } from "./types/errors";

// A round-trip mirrors what crosses the IPC boundary: serialize on one side,
// hand the plain object to the other, rehydrate there.
const roundTrip = (err: unknown): Error => rehydrateSerializedError(serializeError(err));

describe("serializeError / rehydrateSerializedError", () => {
  it("preserves name and message", () => {
    const out = roundTrip(new Error("boom"));
    expect(out).toBeInstanceOf(Error);
    expect(out.message).toBe("boom");
  });

  it("preserves a named error's name", () => {
    const out = roundTrip(new TypeError("nope"));
    expect(out.name).toBe("TypeError");
    expect(out.message).toBe("nope");
  });

  it("recovers the type from constructor.name when the class never sets this.name", () => {
    class NamelessError extends Error {}
    const original = new NamelessError("boom");
    // The live error reports "Error" as its name (no `this.name` assignment), so
    // the only type signal is the runtime class name.
    expect(original.name).toBe("Error");
    expect(roundTrip(original).name).toBe("NamelessError");
  });

  it("prefers an explicit this.name over constructor.name", () => {
    class FancyError extends Error {
      override name = "fancy-error";
    }
    expect(roundTrip(new FancyError("boom")).name).toBe("fancy-error");
  });

  it("preserves the code field", () => {
    const out = roundTrip(Object.assign(new Error("denied"), { code: "EACCES" }));
    expect((out as Error & { code?: string }).code).toBe("EACCES");
  });

  it("preserves extra own-enumerable properties via data", () => {
    const out = roundTrip(Object.assign(new Error("fail"), { retries: 3, where: "disk" }));
    const e = out as Error & { retries?: number; where?: string };
    expect(e.retries).toBe(3);
    expect(e.where).toBe("disk");
  });

  it("skips function-valued properties", () => {
    const out = roundTrip(Object.assign(new Error("fn"), { handler: () => 1 }));
    expect((out as Error & { handler?: unknown }).handler).toBeUndefined();
  });

  it("preserves a nested cause chain", () => {
    const out = roundTrip(new Error("outer", { cause: new Error("root") }));
    assert(out.cause instanceof Error);
    expect(out.cause.message).toBe("root");
  });

  it("coerces non-Error throwables", () => {
    expect(roundTrip("just a string").message).toBe("just a string");
  });

  it("round-trips a DownloadError generically (name + payload, no concrete prototype)", () => {
    const out = roundTrip(
      new DownloadError(
        { code: "network-bad-status", url: new URL("https://cdn.example/file"), statusCode: 503 },
        "Server returned 503",
      ),
    );
    expect(out).not.toBeInstanceOf(DownloadError);
    expect(out.name).toBe("DownloadError");
    expect((out as Error & { code?: string }).code).toBe("network-bad-status");
    expect((out as Error & { payload?: { statusCode: number } }).payload?.statusCode).toBe(503);
  });
});
