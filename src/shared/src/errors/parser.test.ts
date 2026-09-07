import { assert, describe, expect, expectTypeOf, it, test } from "vitest";

import { computeErrorFingerprint } from "../errors";
import { VortexError } from "./base";
import { parseError, parseNodeSystemErrorData } from "./parser";

/** Creates a minimal Node.js SystemError-shaped Error. */
function makeSystemError(
  code: string,
  extras: { errno?: number; syscall?: string; [key: string]: unknown } = {},
): Error {
  return Object.assign(new Error(`${code} mock error`), {
    code,
    errno: extras.errno ?? -2,
    syscall: extras.syscall ?? "open",
    ...extras,
  });
}

describe("parseError", () => {
  it("passes a VortexError through unchanged, with data typed as the full union", () => {
    const original = new VortexError("already typed", { kind: "user-canceled", skipped: false });
    const parsed = parseError(original);

    expect(parsed).toBe(original);
    expectTypeOf(parsed.data).not.toBeAny();
    assert(parsed.data.kind === "user-canceled");
    expect(parsed.data.skipped).toBe(false);
  });

  test.for([
    { label: "string", input: "oops", contains: "oops" },
    { label: "number", input: 42, contains: "Type=number" },
    { label: "plain Error, no code", input: new Error("raw"), contains: "raw" },
  ])("wraps $label as unknown", ({ input, contains }) => {
    const result = parseError(input);
    assert(result.data.kind === "unknown");
    expect(result.message).toContain(contains);
  });

  describe("filesystem codes", () => {
    test.for([
      { code: "ENOENT", kind: "fs:not-found", path: "/missing" },
      { code: "EEXIST", kind: "fs:already-exists", path: "/existing" },
      { code: "ENOSPC", kind: "fs:no-space", path: "/dev/sda1" },
      { code: "EROFS", kind: "fs:read-only", path: "/mnt/readonly/file" },
      { code: "ENOTDIR", kind: "fs:not-a-directory", path: "/not/a/dir" },
      { code: "EISDIR", kind: "fs:not-a-file", path: "/some/dir" },
      { code: "ENOTEMPTY", kind: "fs:directory-not-empty", path: "/non/empty" },
      { code: "EACCES", kind: "fs:no-permissions", path: "/some/file" },
      { code: "EPERM", kind: "fs:no-permissions", path: "/restricted" },
    ] as const)("$code + path -> $kind", ({ code, kind, path }) => {
      const result = parseError(makeSystemError(code, { path }));
      assert(result.data.kind === kind);
      expect((result.data as { path: string }).path).toBe(path);
      expect(result.data.originalCode).toBe(code);
    });

    test.for([{ code: "EACCES" }, { code: "EPERM" }] as const)(
      "$code without a path -> os:generic (not FS-exclusive)",
      ({ code }) => {
        const result = parseError(makeSystemError(code));
        assert(result.data.kind === "os:generic");
      },
    );

    test.for([{ code: "EMFILE" }, { code: "EBUSY" }] as const)(
      "$code -> os:generic, isTransient",
      ({ code }) => {
        const result = parseError(makeSystemError(code));
        assert(result.data.kind === "os:generic");
        expect(result.isTransient).toBe(true);
      },
    );

    it("context.path overrides error.path", () => {
      const err = makeSystemError("ENOENT", { path: "/error/path" });
      const result = parseError(err, { path: "/context/path" });
      assert(result.data.kind === "fs:not-found");
      expect(result.data.path).toBe("/context/path");
    });

    it("context.path promotes EACCES with no error.path to fs:no-permissions", () => {
      const result = parseError(makeSystemError("EACCES"), { path: "/ctx" });
      assert(result.data.kind === "fs:no-permissions");
      expect(result.data.path).toBe("/ctx");
    });
  });

  describe("getMessage callback", () => {
    it("overrides the message when callback returns a string", () => {
      const err = makeSystemError("ENOENT", { path: "/missing" });
      const result = parseError(err, undefined, ({ data }) => {
        if (data.kind === "fs:not-found") return `Custom: ${data.path}`;
        return undefined;
      });
      expect(result.message).toBe("Custom: /missing");
    });

    it("keeps the original message when callback returns undefined", () => {
      const err = makeSystemError("ENOENT", { path: "/missing" });
      const result = parseError(err, undefined, () => undefined);
      expect(result.message).toBe("File or directory does not exist at '/missing'");
    });

    it("receives isTransient in the callback", () => {
      const err = makeSystemError("EBUSY");
      let capturedTransient: boolean | undefined;
      parseError(err, undefined, ({ isTransient }) => {
        capturedTransient = isTransient;
        return undefined;
      });
      expect(capturedTransient).toBe(true);
    });

    it("is not called when passing a VortexError directly", () => {
      let called = false;
      const original = new VortexError("already typed", { kind: "user-canceled", skipped: false });
      parseError(original, undefined, () => {
        called = true;
        return undefined;
      });
      expect(called).toBe(false);
    });

    it("can access narrowed payload fields via kind check", () => {
      const err = makeSystemError("ENOENT", { path: "/my/file" });
      const result = parseError(err, undefined, ({ data }) => {
        if (data.kind === "fs:not-found") {
          return `Deleted ${data.path} via syscall ${data.syscall}`;
        }
        return undefined;
      });
      expect(result.message).toBe("Deleted /my/file via syscall open");
    });

    it("works with context and getMessage together", () => {
      const err = makeSystemError("ENOENT", { path: "/error/path" });
      const result = parseError(err, { path: "/context/path" }, ({ data }) => {
        if (data.kind === "fs:not-found") return `Context path: ${data.path}`;
        return undefined;
      });
      assert(result.data.kind === "fs:not-found");
      expect(result.data.path).toBe("/context/path");
      expect(result.message).toBe("Context path: /context/path");
    });
  });

  describe("network codes", () => {
    const url = "https://api.nexusmods.com/v1/games";

    describe.for([
      { code: "ECONNRESET", isTransient: false },
      { code: "ECONNABORTED", isTransient: false },
      { code: "ECONNREFUSED", isTransient: false },
      { code: "ENETUNREACH", isTransient: false },
      { code: "EAI_AGAIN", isTransient: false },
      { code: "EPROTO", isTransient: false },
      { code: "ETIMEDOUT", isTransient: true },
    ] as const)("$code", ({ code, isTransient }) => {
      it(`with URL -> http:generic, isTransient=${isTransient}`, () => {
        const result = parseError(makeSystemError(code), { url });
        assert(result.data.kind === "http:generic");
        expect(result.data.url).toBe(url);
        expect(result.isTransient).toBe(isTransient);
        expect(result.message).toContain(code);
      });

      it(`without URL -> os:generic, isTransient=${isTransient}`, () => {
        const result = parseError(makeSystemError(code));
        assert(result.data.kind === "os:generic");
        expect(result.isTransient).toBe(isTransient);
      });
    });
  });
});

describe("parseNodeSystemErrorData", () => {
  it("returns data for a valid SystemError", () => {
    const err = makeSystemError("ENOENT", { path: "/some/file" });
    const data = parseNodeSystemErrorData(err);
    expect(data?.code).toBe("ENOENT");
    expect(data?.path).toBe("/some/file");
  });

  test.for([
    { label: "plain Error, no code", input: new Error("plain") },
    { label: "object missing errno/syscall", input: { code: "ENOENT" } },
    { label: "non-object", input: 42 },
  ])("returns undefined for $label", ({ input }) => {
    expect(parseNodeSystemErrorData(input)).toBeUndefined();
  });
});

/** A raw Node system error created right here, so its stack starts at this line. */
const rawFsError = (path: string): Error =>
  Object.assign(new Error("ENOENT mock error"), {
    code: "ENOENT",
    errno: -2,
    syscall: "open",
    path,
  });

describe("throw-site frames", () => {
  it("keeps the frames of the error it classified, not the classifier's own", () => {
    const parsed = parseError(rawFsError("/a"));

    expect(parsed.stack).toBeDefined();
    // parseError builds a new VortexError, so without frame adoption every
    // classified error would report this file instead of the real throw site.
    expect(parsed.stack).not.toContain("parser.ts");
    expect(parsed.stack).toContain("parser.test.ts");
  });

  it("heads the stack with the classified error, not the raw one", () => {
    const parsed = parseError(rawFsError("/a"));

    expect(parsed.stack?.split("\n")[0]).toBe(
      "VortexError: File or directory does not exist at '/a'",
    );
    // The raw message is replaced, so the header can't be the cause's.
    expect(parsed.stack?.split("\n")[0]).not.toContain("mock error");
  });

  it("gives errors from different throw sites different fingerprints", () => {
    // Two raw errors originating on different lines...
    const failingOpen = (): Error => rawFsError("/a");
    const failingRename = (): Error => rawFsError("/b");

    // ...both classified from a single call site, so parseError's own frames are
    // identical for the pair and only the adopted frames can tell them apart.
    // Without adoption these hash alike, which is exactly the bug this guards.
    const fingerprints = [failingOpen, failingRename].map((make) =>
      computeErrorFingerprint(parseError(make()).stack, "1.2.3"),
    );

    expect(fingerprints[0]).toBeDefined();
    expect(fingerprints[0]).not.toBe(fingerprints[1]);
  });

  it("adopts frames for an unrecognised error too", () => {
    const parsed = parseError(new Error("no code here"));

    assert(parsed.data.kind === "unknown");
    expect(parsed.stack).not.toContain("parser.ts");
    expect(parsed.stack).toContain("parser.test.ts");
  });

  it("leaves its own stack in place when the cause has none", () => {
    const cause = rawFsError("/a");
    cause.stack = undefined;

    const parsed = parseError(cause);
    expect(parsed.stack).toBeDefined();
    expect(parsed.stack).toContain("VortexError");
  });

  it("leaves its own stack in place when the cause's stack has no frames", () => {
    const cause = rawFsError("/a");
    cause.stack = "Error: ENOENT mock error";

    const parsed = parseError(cause);
    // A header with nothing under it would fingerprint to undefined, so the
    // classifier's frames are better than none.
    expect(parsed.stack).toContain("at ");
  });
});
