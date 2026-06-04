import { describe, expect, it } from "vitest";

import { rehydrateSerializedError, serializeError } from "../error-serialization";
import { isErrorOfType, ProcessCanceled, UserCanceled } from "./errors";

// Mirrors what an error looks like after crossing the IPC boundary: the
// prototype is gone, so it comes back as a plain Error carrying only `name`.
const acrossWire = (err: unknown): Error => rehydrateSerializedError(serializeError(err));

describe("isErrorOfType", () => {
  it("UserCanceled reports its class as its name", () => {
    expect(new UserCanceled().name).toBe("UserCanceled");
  });

  it("matches a live instance", () => {
    expect(isErrorOfType(new UserCanceled(), UserCanceled)).toBe(true);
  });

  it("matches an IPC-rehydrated instance (instanceof is lost, name survives)", () => {
    const rehydrated = acrossWire(new UserCanceled());
    expect(rehydrated).not.toBeInstanceOf(UserCanceled);
    expect(isErrorOfType(rehydrated, UserCanceled)).toBe(true);
  });

  it("preserves the skipped payload across the wire", () => {
    const rehydrated = acrossWire(new UserCanceled(true)) as Error & { skipped?: boolean };
    expect(rehydrated.skipped).toBe(true);
  });

  it("distinguishes between error types", () => {
    expect(isErrorOfType(new ProcessCanceled("stop"), UserCanceled)).toBe(false);
    expect(isErrorOfType(new UserCanceled(), ProcessCanceled)).toBe(false);
  });

  it("matches an IPC-rehydrated ProcessCanceled", () => {
    const rehydrated = acrossWire(new ProcessCanceled("stop"));
    expect(rehydrated).not.toBeInstanceOf(ProcessCanceled);
    expect(isErrorOfType(rehydrated, ProcessCanceled)).toBe(true);
  });

  it("rejects unrelated errors and non-errors", () => {
    expect(isErrorOfType(new Error("nope"), UserCanceled)).toBe(false);
    expect(isErrorOfType("canceled", UserCanceled)).toBe(false);
  });

  it("narrows the type for callers (compile-time guard)", () => {
    const err: unknown = new UserCanceled(true);
    if (isErrorOfType(err, UserCanceled)) {
      // `err` is narrowed to UserCanceled here; accessing `skipped` must typecheck.
      expect(err.skipped).toBe(true);
    } else {
      throw new Error("expected match");
    }
  });
});
