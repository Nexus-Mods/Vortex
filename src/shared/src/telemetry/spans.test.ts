import type { Span } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";

import { computeErrorFingerprint } from "../errors";
import { recordErrorOnSpan } from "./spans";

const VERSION = "1.0.0";

/** Minimal fake span that records the attributes set on it. */
const fakeSpan = () => {
  const attributes: Record<string, string | number | boolean> = {};
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const span = {
    setAttribute: (key: string, value: string | number | boolean) => {
      attributes[key] = value;
      return span;
    },
    setStatus: () => span,
    recordException: () => undefined,
  } as unknown as Span;
  return { span, attributes };
};

/** Build an error with a fixed stack so the fingerprint only varies by discriminator. */
const errorWithStack = (err: Error): Error => {
  err.stack = ["Error: boom", "    at f (src/foo.ts:1:2)", "    at g (src/bar.ts:3:4)"].join("\n");
  return err;
};

class HttpError extends Error {}

describe("recordErrorOnSpan fingerprint discriminator", () => {
  it("distinguishes errors with the same stack but different constructors", () => {
    const a = fakeSpan();
    const b = fakeSpan();
    recordErrorOnSpan(a.span, errorWithStack(new Error("boom")), VERSION);
    recordErrorOnSpan(b.span, errorWithStack(new TypeError("boom")), VERSION);
    expect(a.attributes["error.fingerprint"]).not.toBe(b.attributes["error.fingerprint"]);
  });

  it("includes the custom error class name in the discriminator", () => {
    const { span, attributes } = fakeSpan();
    recordErrorOnSpan(span, errorWithStack(new HttpError("boom")), VERSION);
    const expected = computeErrorFingerprint(
      ["    at f (src/foo.ts:1:2)", "    at g (src/bar.ts:3:4)"].join("\n"),
      VERSION,
      "HttpError",
    );
    expect(attributes["error.fingerprint"]).toBe(expected);
  });

  it("keeps the generic Error class out of the discriminator (plain errors stay stable)", () => {
    const { span, attributes } = fakeSpan();
    recordErrorOnSpan(span, errorWithStack(new Error("boom")), VERSION);
    const expected = computeErrorFingerprint(
      ["    at f (src/foo.ts:1:2)", "    at g (src/bar.ts:3:4)"].join("\n"),
      VERSION,
    );
    expect(attributes["error.fingerprint"]).toBe(expected);
  });

  it("falls back to error.name when constructor.name is the generic Error (IPC-rehydrated)", () => {
    // Mirrors an error rebuilt by rehydrateSerializedError: a plain Error whose
    // only type signal is `name` (constructor.name is "Error").
    const { span, attributes } = fakeSpan();
    const rehydrated = errorWithStack(new Error("boom"));
    rehydrated.name = "FileSystemError";
    recordErrorOnSpan(span, rehydrated, VERSION);
    const expected = computeErrorFingerprint(
      ["    at f (src/foo.ts:1:2)", "    at g (src/bar.ts:3:4)"].join("\n"),
      VERSION,
      "FileSystemError",
    );
    expect(attributes["error.fingerprint"]).toBe(expected);
  });

  it("combines constructor name with the error code", () => {
    const { span, attributes } = fakeSpan();
    const err = Object.assign(errorWithStack(new TypeError("boom")), { code: "ENOENT" });
    recordErrorOnSpan(span, err, VERSION);
    const expected = computeErrorFingerprint(
      ["    at f (src/foo.ts:1:2)", "    at g (src/bar.ts:3:4)"].join("\n"),
      VERSION,
      "TypeError:ENOENT",
    );
    expect(attributes["error.fingerprint"]).toBe(expected);
  });
});
