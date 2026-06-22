import { describe, expect, it } from "vitest";

import {
  type ErrorOriginTracker,
  rehydrateSerializedError,
  serializeError,
} from "./error-serialization";
import { DownloadError, ProcessCanceled } from "./types/errors";

// A round-trip mirrors what crosses the IPC boundary: serialize on one side,
// hand the plain object to the other, rehydrate there. An optional tracker is
// threaded through both ends, the way a caller (preload) owns and passes it.
const roundTrip = (err: unknown, tracker?: ErrorOriginTracker): Error =>
  rehydrateSerializedError(serializeError(err, tracker), tracker);

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
    expect((out.cause as Error).message).toBe("root");
  });

  it("coerces non-Error throwables", () => {
    expect(roundTrip("just a string").message).toBe("just a string");
  });

  it("round-trips a DownloadError generically (name + code + payload, no concrete prototype)", () => {
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

describe("by-reference origin tracker", () => {
  // Mimic the renderer's preload tracker: a namespaced stash that hands back the
  // same live object on return. Owned by the caller and passed in — no globals.
  const makeTracker = (namespace = "test"): ErrorOriginTracker => {
    const stash = new Map<string, Error>();
    let seq = 0;
    return {
      namespace,
      capture: (err) => {
        const id = `${seq++}`;
        stash.set(id, err);
        return id;
      },
      resolve: (id) => {
        const err = stash.get(id);
        if (err !== undefined) stash.delete(id);
        return err;
      },
    };
  };

  it("returns the original object (identity + prototype + stack) on round-trip", () => {
    const tracker = makeTracker();
    const original = new ProcessCanceled("Wrong user id");
    const out = roundTrip(original, tracker);
    expect(out).toBe(original); // same reference, not a copy
    expect(out.stack).toBe(original.stack); // real throw-site stack preserved
  });

  it("resolves the original even when relayed through a context that re-serializes it", () => {
    const tracker = makeTracker();
    const original = new ProcessCanceled("Wrong user id");

    // renderer: capture + tag the wire form (namespaced)
    const onWire = serializeError(original, tracker);
    expect(onWire.data?.["__originRef"]).toBe("test:0");

    // main (no tracker): hydrate then re-serialize — the ref must ride through
    const relayed = serializeError(rehydrateSerializedError(onWire));
    expect(relayed.data?.["__originRef"]).toBe("test:0");

    // renderer regains ownership and gets the original back
    expect(rehydrateSerializedError(relayed, tracker)).toBe(original);
  });

  it("resolves the original carried on a wrapped error's cause chain", () => {
    const tracker = makeTracker();
    const original = new ProcessCanceled("Wrong user id");
    // Wire shape of a wrapper (e.g. main's "Resolver failed") whose cause is the
    // captured original — mirrors main wrapping a relayed renderer callback error.
    const wire = { message: "Resolver failed", cause: serializeError(original, tracker) };
    expect(rehydrateSerializedError(wire, tracker).cause as Error).toBe(original);
  });

  it("ignores a ref minted under a different namespace (no cross-context mis-resolve)", () => {
    // Context A captures and tags the wire under its namespace.
    const trackerA = makeTracker("main");
    const original = new ProcessCanceled("from main");
    const onWire = serializeError(original, trackerA);
    expect(onWire.data?.["__originRef"]).toBe("main:0");

    // Context B has a colliding local id "0" but a different namespace — it must
    // NOT resolve A's ref, and must fall back to hydration instead.
    const stashB = new Map<string, Error>([["0", new Error("unrelated B error")]]);
    const trackerB: ErrorOriginTracker = {
      namespace: "renderer",
      capture: () => undefined,
      resolve: (id) => stashB.get(id),
    };
    const out = rehydrateSerializedError(onWire, trackerB);
    expect(out).not.toBe(original);
    expect(out).not.toBe(stashB.get("0"));
    expect(out.name).toBe("ProcessCanceled");
  });

  it("falls back to a generic Error when no tracker is passed (foreign context)", () => {
    const onWire = serializeError(new ProcessCanceled("gone"));
    // No tracker on this side → plain Error carrying the name, which name-based
    // checks (isErrorOfType) still match.
    const out = rehydrateSerializedError(onWire);
    expect(out).not.toBeInstanceOf(ProcessCanceled);
    expect(out.name).toBe("ProcessCanceled");
    expect(out.message).toBe("gone");
  });
});
