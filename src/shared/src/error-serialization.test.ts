import { assert, describe, expect, it } from "vitest";

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

// Everything the serializer copies into `data` is structured-cloned by Electron
// when it crosses a channel. A live library error (got attaches its Request,
// Response and options — sockets, streams and hook functions included, some as
// non-enumerable own properties) would otherwise take the whole envelope down
// with "An object could not be cloned", losing the real error.
describe("clone-safety of carried fields", () => {
  /** Stands in for the native-backed objects a live error holds. */
  class FakeSocket {
    readonly fd = 3;
    write(): void {}
  }

  /** Shaped like the errors got throws. */
  const errorWithLiveReferences = () => {
    const err = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    Object.defineProperty(err, "request", {
      enumerable: false,
      value: { socket: new FakeSocket(), write: () => {} },
    });
    Object.defineProperty(err, "options", {
      enumerable: true,
      value: { hooks: { beforeError: [() => {}] }, retryCount: 2 },
    });
    return err;
  };

  it("keeps the serialized form cloneable", () => {
    const serialized = serializeError(errorWithLiveReferences());

    expect(() => structuredClone(serialized)).not.toThrow();
  });

  it("still carries message, name and code", () => {
    const out = roundTrip(errorWithLiveReferences());

    expect(out.message).toBe("socket hang up");
    expect((out as Error & { code?: string }).code).toBe("ECONNRESET");
  });

  it("carries a nested cause without its live references", () => {
    const err = new Error("upload failed", { cause: errorWithLiveReferences() });

    const serialized = serializeError(err);

    expect(() => structuredClone(serialized)).not.toThrow();
    expect(serialized.cause?.code).toBe("ECONNRESET");
  });

  it("keeps plain data intact", () => {
    const err = Object.assign(new Error("boom"), {
      count: 3,
      flag: true,
      nested: { deep: { list: [1, "two", null] } },
      when: new Date(0),
      tags: new Set(["a"]),
      lookup: new Map([["k", "v"]]),
    });

    const out = roundTrip(err) as Error & {
      count?: number;
      flag?: boolean;
      nested?: unknown;
      when?: unknown;
      tags?: unknown;
      lookup?: unknown;
    };

    expect(out.count).toBe(3);
    expect(out.flag).toBe(true);
    expect(out.nested).toEqual({ deep: { list: [1, "two", null] } });
    expect(out.when).toEqual(new Date(0));
    expect(out.tags).toEqual(new Set(["a"]));
    expect(out.lookup).toEqual(new Map([["k", "v"]]));
  });

  it("stringifies a URL rather than dropping it", () => {
    const err = Object.assign(new Error("boom"), {
      payload: { url: new URL("https://cdn.example/file"), statusCode: 503 },
    });

    const out = roundTrip(err) as Error & { payload?: unknown };

    expect(out.payload).toEqual({ url: "https://cdn.example/file", statusCode: 503 });
  });

  it("carries a class instance as plain data", () => {
    // Its methods live on the prototype, so the clone keeps the fields and
    // sheds the behaviour — which is all the wire could carry anyway.
    const err = Object.assign(new Error("boom"), {
      handle: new FakeSocket(),
      keep: "kept",
    });

    const out = roundTrip(err) as Error & { keep?: string; handle?: unknown };

    expect(out.keep).toBe("kept");
    expect(out.handle).toEqual({ fd: 3 });
  });

  it("drops a whole value containing something uncloneable, not just the bad part", () => {
    const err = Object.assign(new Error("boom"), {
      items: [1, () => {}, 3],
      keep: "kept",
    });

    const out = roundTrip(err) as Error & { items?: unknown; keep?: string };

    // Dropping only the function would silently reindex the array.
    expect(out.items).toBeUndefined();
    expect(out.keep).toBe("kept");
  });

  it("preserves a cyclic value", () => {
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;
    const err = Object.assign(new Error("boom"), { cyclic, keep: "kept" });

    const serialized = serializeError(err);

    expect(() => structuredClone(serialized)).not.toThrow();
    expect(serialized.data?.keep).toBe("kept");
    const carried: unknown = serialized.data?.cyclic;
    assert(carried !== null && typeof carried === "object" && "self" in carried);
    expect(carried).toHaveProperty("name", "loop");
    // The cycle survives rather than being unrolled or pruned.
    expect(carried.self).toBe(carried);
  });

  it("detaches the carried value from the live error", () => {
    const mutable = { count: 1 };
    const err = Object.assign(new Error("boom"), { mutable });

    const serialized = serializeError(err);
    mutable.count = 99;

    expect(serialized.data?.mutable).toEqual({ count: 1 });
  });

  it("lets a value appearing twice in different branches through", () => {
    const shared = { id: 1 };
    const err = Object.assign(new Error("boom"), { left: shared, right: shared });

    const out = roundTrip(err) as Error & { left?: unknown; right?: unknown };

    expect(out.left).toEqual({ id: 1 });
    expect(out.right).toEqual({ id: 1 });
  });
});

describe("by-reference origin tracker", () => {
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
    expect(rehydrateSerializedError(wire, tracker).cause).toBe(original);
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
