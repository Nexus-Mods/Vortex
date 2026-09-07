import { assert, describe, expect, it } from "vitest";

import { VortexError } from "./base";
import {
  ORIGIN_REF_KEY,
  type ErrorOriginTracker,
  deserializeVortexError,
  serializeVortexError,
  toWireError,
} from "./serialization";

// All kinds used by the tests are declared locally so the suite isn't tied to
// the shape of the shared kind catalog (which can grow or shift).
declare module "./base" {
  interface VortexErrorKindMap {
    "test:simple": { flag: boolean };
    "test:list": { items: string[] };
    "test:nested": { inner: { code: number } };
    "test:deep": { tag: string };
    "test:middle": { value: number };
    "test:outer": { reason: string };
    "test:tag": { name: string };
  }
}

const makeTracker = (
  namespace: string,
): ErrorOriginTracker & { stash: Map<string, VortexError> } => {
  const stash = new Map<string, VortexError>();
  let seq = 0;
  return {
    namespace,
    stash,
    capture: (err) => {
      const id = `${seq++}`;
      stash.set(id, err);
      return id;
    },
    resolve: (id) => stash.get(id),
  };
};

describe("serializeVortexError / deserializeVortexError", () => {
  it("round-trips message, kind, and data payload", () => {
    const original = new VortexError("hi", { kind: "test:simple", flag: true });
    const out = deserializeVortexError(serializeVortexError(original));

    expect(out.message).toBe("hi");
    assert(out.data.kind === "test:simple");
    expect(out.data.flag).toBe(true);
  });

  it("preserves the transient flag when the classifier set it true", () => {
    const original = new VortexError(
      "retry",
      { kind: "test:simple", flag: false },
      { isTransient: true },
    );
    const wire = serializeVortexError(original);
    expect(wire.isTransient).toBe(true);
    expect(deserializeVortexError(wire).isTransient).toBe(true);
  });

  it("carries a nested cause chain of VortexErrors", () => {
    const root = new VortexError("root", { kind: "test:deep", tag: "r" });
    const middle = new VortexError("mid", { kind: "test:middle", value: 1 }, { cause: root });
    const outer = new VortexError("top", { kind: "test:outer", reason: "x" }, { cause: middle });

    const out = deserializeVortexError(serializeVortexError(outer));
    expect(out.data.kind).toBe("test:outer");

    const cause1 = out.cause;
    assert(cause1 instanceof VortexError);
    expect(cause1.data.kind).toBe("test:middle");

    const cause2 = cause1.cause;
    assert(cause2 instanceof VortexError);
    expect(cause2.data.kind).toBe("test:deep");
    expect(cause2.cause).toBeUndefined();
  });

  it("truncates the cause chain beyond MAX_CAUSE_DEPTH", () => {
    // Build a chain that exceeds the limit so truncation is observable.
    let current: VortexError = new VortexError("innermost", { kind: "test:deep", tag: "r" });
    for (let i = 0; i < 8; i++) {
      current = new VortexError(`level ${i}`, { kind: "test:deep", tag: "r" }, { cause: current });
    }
    const out = deserializeVortexError(serializeVortexError(current));

    let level = 0;
    let err: VortexError | undefined = out;
    while (err?.cause instanceof VortexError) {
      err = err.cause;
      level++;
    }
    expect(level).toBe(5);
  });

  it("coerces a non-VortexError Error cause into a VortexError cause", () => {
    const plain = new Error("root");
    const outer = new VortexError("top", { kind: "test:outer", reason: "x" }, { cause: plain });

    const wire = serializeVortexError(outer);
    expect(wire.cause).toBeDefined();

    const out = deserializeVortexError(wire);
    const cause = out.cause;
    assert(cause instanceof VortexError);
    expect(cause.message).toContain("root");
  });

  it("drops non-Error causes", () => {
    const outer = new VortexError(
      "top",
      { kind: "test:outer", reason: "x" },
      {
        cause: "just a string",
      },
    );

    expect(serializeVortexError(outer).cause).toBeUndefined();
  });

  it("clone-safely carries structured payload values", () => {
    const original = new VortexError("list", { kind: "test:list", items: ["a", "b", "c"] });
    const wire = serializeVortexError(original);
    expect(() => structuredClone(wire)).not.toThrow();

    const deserialized = deserializeVortexError(wire);
    assert(deserialized.data.kind === "test:list");
    expect(deserialized.data.items).toEqual(["a", "b", "c"]);
  });

  it("clone-safely carries nested payload values", () => {
    const original = new VortexError("nested", { kind: "test:nested", inner: { code: 42 } });
    const wire = serializeVortexError(original);
    expect(() => structuredClone(wire)).not.toThrow();

    const deserialized = deserializeVortexError(wire);
    assert(deserialized.data.kind === "test:nested");

    expect(deserialized.data.inner).toMatchObject({ code: 42 });
  });
});

describe("toWireError (boundary entry point)", () => {
  it("passes a VortexError through and tags the ref token", () => {
    const tracker = makeTracker("test");
    const original = new VortexError("boom", { kind: "test:tag", name: "x" });
    const wire = toWireError(original, tracker);

    expect(wire.data.kind).toBe("test:tag");
    expect(wire.data[ORIGIN_REF_KEY]).toBe("test:0");
    expect(tracker.stash.size).toBe(1);
  });

  it("coerces a plain Error into a VortexError", () => {
    const wire = toWireError(new Error("boom"));
    expect(wire.message).toContain("boom");
    expect(wire.data.kind).toBeDefined();
    expect(wire.data[ORIGIN_REF_KEY]).toBeUndefined();
  });

  it("does not tag a ref token when no tracker is passed", () => {
    const wire = toWireError(new VortexError("hi", { kind: "test:tag", name: "x" }));
    expect(wire.data[ORIGIN_REF_KEY]).toBeUndefined();
  });

  it("preserves the live error object through a tracker round-trip", () => {
    const tracker = makeTracker("renderer");
    const original = new VortexError("hi", { kind: "test:tag", name: "x" });

    const out = deserializeVortexError(toWireError(original, tracker), tracker);
    expect(out).toBe(original);
  });

  it("preserves the live error across a relay (re-serialization in transit)", () => {
    const tracker = makeTracker("renderer");
    const original = new VortexError("hi", { kind: "test:tag", name: "x" });

    const onWire = toWireError(original, tracker);
    expect(onWire.data[ORIGIN_REF_KEY]).toBe("renderer:0");

    // Transit (no tracker): rehydrate, then re-serialize.
    const rehydrated = deserializeVortexError(onWire);
    assert(ORIGIN_REF_KEY in rehydrated.data && rehydrated.data[ORIGIN_REF_KEY] === "renderer:0");

    const relayed = serializeVortexError(rehydrated);
    expect(relayed.data[ORIGIN_REF_KEY]).toBe("renderer:0");

    expect(deserializeVortexError(relayed, tracker)).toBe(original);
  });

  it("ignores a ref minted under a different namespace", () => {
    const trackerA = makeTracker("main");
    const original = new VortexError("from main", { kind: "test:tag", name: "x" });
    const onWire = toWireError(original, trackerA);
    expect(onWire.data[ORIGIN_REF_KEY]).toBe("main:0");

    const stashB = new Map<string, VortexError>([
      ["0", new VortexError("unrelated", { kind: "test:tag", name: "y" })],
    ]);
    const trackerB: ErrorOriginTracker = {
      namespace: "renderer",
      capture: () => undefined,
      resolve: (id) => stashB.get(id),
    };

    const out = deserializeVortexError(onWire, trackerB);
    expect(out).not.toBe(original);
    expect(out).not.toBe(stashB.get("0"));
    expect(out.data.kind).toBe("test:tag");
  });
});
