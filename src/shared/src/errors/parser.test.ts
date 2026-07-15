import { assert, describe, expect, it, test } from "vitest";

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
  it("passes a VortexError through unchanged", () => {
    const original = new VortexError("already typed", { kind: "user-canceled", skipped: false });
    expect(parseError(original)).toBe(original);
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
