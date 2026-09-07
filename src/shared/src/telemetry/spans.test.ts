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

/** A wrapper as `parseError` builds one: its own frames point at the
 *  classifier, the error it wraps has the real throw site. */
const wrapped = (): Error => {
  const cause = new Error("EPERM: operation not permitted");
  cause.stack = ["Error: EPERM: operation not permitted", "    at open (src/fs.ts:9:1)"].join("\n");
  const classified = new Error("no permissions", { cause });
  classified.stack = ["Error: no permissions", "    at classify (src/parser.ts:1:1)"].join("\n");
  return classified;
};

describe("recordErrorOnSpan throw-site resolution", () => {
  it("reports the cause's frames under the wrapper's own header", () => {
    const { span, attributes } = fakeSpan();
    recordErrorOnSpan(span, wrapped(), VERSION);

    // The fingerprint is computed from the stack the span reports, so matching
    // it against the cause's frames proves which stack was chosen.
    expect(attributes["error.fingerprint"]).toBe(
      computeErrorFingerprint("    at open (src/fs.ts:9:1)", VERSION, undefined),
    );
  });

  it("does not use the wrapper's own frames", () => {
    const a = fakeSpan();
    const b = fakeSpan();
    const bare = new Error("no permissions");
    bare.stack = ["Error: no permissions", "    at classify (src/parser.ts:1:1)"].join("\n");

    recordErrorOnSpan(a.span, wrapped(), VERSION);
    recordErrorOnSpan(b.span, bare, VERSION);

    expect(a.attributes["error.fingerprint"]).not.toBe(b.attributes["error.fingerprint"]);
  });

  it("keeps its own frames when the cause has none", () => {
    const { span, attributes } = fakeSpan();
    const cause = new Error("opaque");
    cause.stack = "Error: opaque";
    const err = new Error("wrapper", { cause });
    err.stack = ["Error: wrapper", "    at f (src/foo.ts:1:2)"].join("\n");

    recordErrorOnSpan(span, err, VERSION);

    expect(attributes["error.fingerprint"]).toBe(
      computeErrorFingerprint("    at f (src/foo.ts:1:2)", VERSION, undefined),
    );
  });

  it("survives a cause chain that loops", () => {
    const { span, attributes } = fakeSpan();
    const a = new Error("a");
    a.stack = ["Error: a", "    at a (src/a.ts:1:1)"].join("\n");
    const b = new Error("b", { cause: a });
    b.stack = ["Error: b", "    at b (src/b.ts:1:1)"].join("\n");
    (a as { cause?: unknown }).cause = b;

    recordErrorOnSpan(span, b, VERSION);

    expect(attributes["error.fingerprint"]).toBeDefined();
  });
});
