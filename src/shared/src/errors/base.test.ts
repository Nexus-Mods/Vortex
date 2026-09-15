import { assert, describe, expect, it } from "vitest";

import { CAUSE_SEPARATOR, VortexError } from "./base";

// Proves the `declare module` extensibility mechanism actually works: a kind
// declared here, outside base.ts, must widen VortexErrorKind/VortexErrorData
// so the augmented kind's payload shape is required and enforced by
// TypeScript, the same way it would be for an extension or another package.
// If this augmentation didn't merge, the `new VortexError(...)` call below
// would fail to typecheck (unknown kind literal, unknown payload shape).
declare module "./base" {
  interface VortexErrorKindMap {
    "test:augmented-kind": { extra: string };
  }
}

describe("VortexError", () => {
  it("is an instanceof Error", () => {
    const err = new VortexError("foo", { kind: "unknown" });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(VortexError);
  });

  it("narrows the payload shape by kind", () => {
    const err: VortexError = new VortexError("File not found", {
      kind: "fs:not-found",
      path: "/some/path",
      originalCode: "ENOENT",
      errno: -2,
      syscall: "open",
    });

    assert(err.data.kind === "fs:not-found");

    // Narrowing on data.kind should give TypeScript access to the fs-specific
    // payload fields without a cast.
    expect(err.data.path).toBe("/some/path");
    expect(err.data.originalCode).toBe("ENOENT");
  });

  it("preserves the cause chain", () => {
    const cause = new Error("root cause");
    const err = new VortexError("wrapped", { kind: "unknown" }, { cause });

    expect(err.cause).toBe(cause);
  });

  it("accepts a kind declared via declare module augmentation from another module", () => {
    const err: VortexError = new VortexError("Augmented kind error", {
      kind: "test:augmented-kind",
      extra: "value",
    });

    assert(err.data.kind === "test:augmented-kind");
    expect(err.data.extra).toBe("value");
  });
});

const causeWithStack = (): Error => {
  const cause = new Error("EPERM");
  cause.stack = "Error: EPERM\n    at open (src/fs.ts:9:1)";
  return cause;
};

describe("VortexError stack", () => {
  it("keeps only its own frames when there is no cause", () => {
    const err = new VortexError("plain", { kind: "unknown" });

    expect(err.stack).not.toContain(CAUSE_SEPARATOR);
  });

  it("appends the cause's stack after its own", () => {
    const cause = causeWithStack();
    const err = new VortexError("wrapper", { kind: "unknown" }, { cause });

    const [own, appended] = err.stack?.split(`\n${CAUSE_SEPARATOR}`) ?? [];
    expect(own).toMatch(/^VortexError: wrapper\n\s+at /);
    expect(appended).toBe(cause.stack);
  });

  it("chains through nested VortexErrors, outermost first", () => {
    const root = causeWithStack();
    const middle = new VortexError("middle", { kind: "unknown" }, { cause: root });
    const top = new VortexError("top", { kind: "unknown" }, { cause: middle });

    expect(top.stack?.split(`\n${CAUSE_SEPARATOR}`)).toHaveLength(3);
    expect(top.stack?.endsWith(root.stack ?? "")).toBe(true);
  });

  it("walks a plain Error's causes, which V8 leaves out of its stack", () => {
    const root = causeWithStack();
    const fetchFailed = new TypeError("fetch failed", { cause: root });
    fetchFailed.stack = "TypeError: fetch failed\n    at fetch (node:internal/deps/undici:1:1)";
    const err = new VortexError("wrapper", { kind: "unknown" }, { cause: fetchFailed });

    expect(err.stack?.split(`\n${CAUSE_SEPARATOR}`)).toHaveLength(3);
    expect(err.stack?.endsWith(root.stack ?? "")).toBe(true);
  });

  it("skips a stackless link without ending the walk", () => {
    const root = causeWithStack();
    const opaque = Object.assign(new Error("opaque", { cause: root }), { stack: undefined });
    const err = new VortexError("wrapper", { kind: "unknown" }, { cause: opaque });

    expect(err.stack?.split(`\n${CAUSE_SEPARATOR}`)).toHaveLength(2);
    expect(err.stack?.endsWith(root.stack ?? "")).toBe(true);
  });

  it("stops walking at a VortexError, whose stack already carries its chain", () => {
    const root = causeWithStack();
    const inner = new VortexError("inner", { kind: "unknown" }, { cause: root });
    const outer = new VortexError("outer", { kind: "unknown" }, { cause: inner });

    // Would be 4 if `root` were appended once by `inner` and again by `outer`.
    expect(outer.stack?.split(`\n${CAUSE_SEPARATOR}`)).toHaveLength(3);
  });

  it("bounds the walk", () => {
    let tail: Error = causeWithStack();
    for (let i = 0; i < 8; i += 1) {
      tail = Object.assign(new Error(`link ${i}`, { cause: tail }), { stack: `Error: link ${i}` });
    }
    const err = new VortexError("wrapper", { kind: "unknown" }, { cause: tail });

    expect(err.stack?.split(`\n${CAUSE_SEPARATOR}`)).toHaveLength(6);
  });

  it("terminates on a cause chain that loops", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    (a as { cause?: unknown }).cause = b;

    expect(() => new VortexError("wrapper", { kind: "unknown" }, { cause: a })).not.toThrow();
  });

  it("does not mutate the cause", () => {
    const cause = causeWithStack();
    const before = cause.stack;
    const err = new VortexError("wrapper", { kind: "unknown" }, { cause });

    expect(err.cause).toBe(cause);
    expect(cause.stack).toBe(before);
  });

  it.each([
    ["a string", "just a string"],
    ["an object with a stack property", { stack: "Error: fake\n    at open (src/fs.ts:9:1)" }],
    ["an Error without a stack", Object.assign(new Error("opaque"), { stack: undefined })],
  ])("appends nothing for a cause that is %s", (_label, cause) => {
    const err = new VortexError("wrapper", { kind: "unknown" }, { cause });

    expect(err.stack).not.toContain(CAUSE_SEPARATOR);
  });
});
