import type { Span } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";

import { computeErrorFingerprint } from "../errors";
import { CAUSE_SEPARATOR } from "../errors/base";
import { recordErrorOnSpan } from "./spans";

const VERSION = "1.0.0";

/** Minimal fake span that records the attributes set on it. */
const fakeSpan = () => {
  const attributes: Record<string, string | number | boolean> = {};
  const exceptions: Error[] = [];
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const span = {
    setAttribute: (key: string, value: string | number | boolean) => {
      attributes[key] = value;
      return span;
    },
    setStatus: () => span,
    recordException: (exception: Error) => {
      exceptions.push(exception);
    },
  } as unknown as Span;
  return { span, attributes, exceptions };
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

/** A wrapper as VortexError builds one: its own frames point at the
 *  classifier, then the wrapped error's stack with the real throw site. */
const wrapped = (): Error => {
  const err = new Error("no permissions");
  err.stack = [
    "Error: no permissions",
    "    at classify (src/parser.ts:1:1)",
    `${CAUSE_SEPARATOR}Error: EPERM: operation not permitted`,
    "    at open (src/fs.ts:9:1)",
  ].join("\n");
  return err;
};

describe("recordErrorOnSpan chained stacks", () => {
  it("fingerprints the throw site, not the wrapper", () => {
    const { span, attributes } = fakeSpan();
    recordErrorOnSpan(span, wrapped(), VERSION);

    expect(attributes["error.fingerprint"]).toBe(
      computeErrorFingerprint("    at open (src/fs.ts:9:1)", VERSION, undefined),
    );
  });

  it("reports the whole chain in exception.stacktrace", () => {
    const { span, exceptions } = fakeSpan();
    recordErrorOnSpan(span, wrapped(), VERSION);

    expect(exceptions[0]?.stack).toBe(wrapped().stack);
  });

  it("does not group by the wrapper's frames", () => {
    const a = fakeSpan();
    const b = fakeSpan();
    const bare = new Error("no permissions");
    bare.stack = ["Error: no permissions", "    at classify (src/parser.ts:1:1)"].join("\n");

    recordErrorOnSpan(a.span, wrapped(), VERSION);
    recordErrorOnSpan(b.span, bare, VERSION);

    expect(a.attributes["error.fingerprint"]).not.toBe(b.attributes["error.fingerprint"]);
  });
});
