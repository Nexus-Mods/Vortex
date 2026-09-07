import { assert, describe, expect, it } from "vitest";

import { ProcessCanceled, UserCanceled } from "../types/errors";
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

describe("instanceof by kind", () => {
  it("matches the subclass an error was thrown as", () => {
    expect(new UserCanceled() instanceof UserCanceled).toBe(true);
    expect(new UserCanceled() instanceof VortexError).toBe(true);
  });

  it("does not match a different subclass", () => {
    expect(new UserCanceled() instanceof ProcessCanceled).toBe(false);
    expect(new ProcessCanceled("nope") instanceof UserCanceled).toBe(false);
  });

  it("matches a base VortexError carrying the subclass's kind", () => {
    // How an error arrives after crossing IPC: rebuilt from `data` alone, so it
    // is a base VortexError even though it was thrown as UserCanceled.
    const rehydrated = new VortexError("canceled by user", {
      kind: "user-canceled",
      skipped: false,
    });

    expect(rehydrated instanceof UserCanceled).toBe(true);
    expect(rehydrated instanceof ProcessCanceled).toBe(false);
  });

  it("rejects errors that are not VortexErrors", () => {
    expect(new Error("plain") instanceof VortexError).toBe(false);
    expect(new Error("plain") instanceof UserCanceled).toBe(false);
  });

  it("rejects non-errors, including a look-alike with the right kind", () => {
    expect((null as unknown) instanceof UserCanceled).toBe(false);
    expect((undefined as unknown) instanceof UserCanceled).toBe(false);
    expect(("user-canceled" as unknown) instanceof UserCanceled).toBe(false);
    expect({ data: { kind: "user-canceled" } } instanceof UserCanceled).toBe(false);
  });
});
