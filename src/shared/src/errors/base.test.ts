import { assert, describe, expect, expectTypeOf, it } from "vitest";

import { isVortexError, VortexError } from "./base";

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

  it("narrows an unknown value to typed kind payloads via isVortexError", () => {
    const err: unknown = new VortexError("File not found", {
      kind: "fs:not-found",
      path: "/some/path",
    });

    assert(isVortexError(err));

    // A bare `instanceof VortexError` narrows `unknown` to `VortexError<any>`,
    // silently making `data` an `any`; the guard keeps `data` the full
    // discriminated union.
    expectTypeOf(err.data).not.toBeAny();

    assert(err.data.kind === "fs:not-found");
    expectTypeOf(err.data.path).toEqualTypeOf<string>();
    expect(err.data.path).toBe("/some/path");
  });

  it("rejects non-VortexError values in isVortexError", () => {
    expect(isVortexError(new Error("plain"))).toBe(false);
    expect(isVortexError(undefined)).toBe(false);
    expect(isVortexError("boom")).toBe(false);
  });

  it("narrows to a single kind's payload when isVortexError is given the kind", () => {
    const err: unknown = new VortexError("File not found", {
      kind: "fs:not-found",
      path: "/some/path",
    });

    assert(isVortexError(err, "fs:not-found"));

    expectTypeOf(err.data.kind).toEqualTypeOf<"fs:not-found">();
    expectTypeOf(err.data.path).toEqualTypeOf<string>();
    expect(err.data.path).toBe("/some/path");
  });

  it("rejects a VortexError of a different kind when isVortexError is given a kind", () => {
    const err: unknown = new VortexError("File not found", {
      kind: "fs:not-found",
      path: "/some/path",
    });

    expect(isVortexError(err, "user-canceled")).toBe(false);
    expect(isVortexError(new Error("plain"), "fs:not-found")).toBe(false);
  });
});
