import { assert, describe, expect, it } from "vitest";

import { VortexError } from "./base";

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
