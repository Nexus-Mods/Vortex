import { describe, expect, it } from "vitest";

import { VortexError } from "../errors/base";
import {
  getRootLength,
  getPathRoot,
  isPathSanitized,
  isRootDirectory,
  isRooted,
  isValidWindowsDriveChar,
  parseNativePath,
  sanitizePath,
} from "./native";

describe("getPathRoot", () => {
  it.each([
    ["", "None", ""],
    ["relative/path", "None", ""],
    ["relative.txt", "None", ""],
    ["C:.txt", "None", ""],
    ["/", "Unix", "/"],
    ["/foo/bar", "Unix", "/"],
    ["C:/foo/bar", "DOS", "C:/"],
    ["c:/foo", "DOS", "c:/"],
    ["//Server/share/file.txt", "UNC", "//Server/share/"],
    ["//Server/share/", "UNC", "//Server/share/"],
    ["//Server/share", "UNC", "//Server/share"],
    ["//./C:/foo", "DOSDeviceDrive", "//./C:/"],
    ["//?/C:/foo", "DOSDeviceDrive", "//?/C:/"],
    [
      "//./Volume{b75e2c83-0000-0000-0000-602f00000000}/foo",
      "DOSDeviceVolume",
      "//./Volume{b75e2c83-0000-0000-0000-602f00000000}/",
    ],
    [
      "//?/Volume{b75e2c83-0000-0000-0000-602f00000000}/",
      "DOSDeviceVolume",
      "//?/Volume{b75e2c83-0000-0000-0000-602f00000000}/",
    ],
  ])('"%s" -> (%s, "%s")', (input, expectedType, expectedSpan) => {
    const root = getPathRoot(input);
    expect(root.type).toBe(expectedType);
    expect(root.span).toBe(expectedSpan);
  });

  it.each([
    ["1:/foo", "invalid windows drive character"],
    ["//.", "too small to be a valid rooted path"],
    ["//Server", "Invalid UNC path, missing share"],
    ["//Server/", "Invalid UNC path, missing share"],
    ["//./1:/foo", "invalid windows drive character"],
    ["//./Volume{bad}/foo", "Path is not a valid DOS Device Volume path"],
    ["//./Foo{b75e2c83-0000-0000-0000-602f00000000}/foo", "missing DOS Device Volume prefix"],
  ])('throws on "%s" (%s)', (input, expectedMessage) => {
    expect(() => getPathRoot(input)).toThrow(VortexError);
    expect(() => getPathRoot(input)).toThrow(new RegExp(expectedMessage));
  });
});

describe("sanitizePath", () => {
  it.each([
    ["", ""],
    ["foo", "foo"],
    ["foo ", "foo"],
    ["foo/bar", "foo/bar"],
    ["foo/bar/", "foo/bar"],
    ["foo/bar/ ", "foo/bar"],
    ["foo\\bar", "foo/bar"],
    ["foo\\bar\\", "foo/bar"],
    ["/", "/"],
    ["//", "/"],
    ["/foo", "/foo"],
    ["/foo/", "/foo"],
    ["/foo//bar//", "/foo/bar"],
    ["C:\\", "C:/"],
    ["C:\\foo", "C:/foo"],
    ["C:\\foo\\", "C:/foo"],
    ["\\\\Server\\\\foo", "//Server/foo/"],
    ["\\\\Server\\share", "//Server/share/"],
    ["\\\\Server\\share\\", "//Server/share/"],
    ["\\\\.\\C:\\foo", "//./C:/foo"],
    ["\\\\?\\C:\\foo", "//?/C:/foo"],
    [
      "\\\\.\\Volume{b75e2c83-0000-0000-0000-602f00000000}\\foo",
      "//./Volume{b75e2c83-0000-0000-0000-602f00000000}/foo",
    ],
    [
      "\\\\?\\Volume{b75e2c83-0000-0000-0000-602f00000000}\\foo",
      "//?/Volume{b75e2c83-0000-0000-0000-602f00000000}/foo",
    ],
  ])('"%s" -> "%s"', (input, expected) => {
    const sanitized = sanitizePath(input);
    expect(sanitized).toBe(expected);
    // sanitized output is idempotent
    expect(isPathSanitized(sanitized)).toBe(true);
    expect(sanitizePath(sanitized)).toBe(sanitized);
  });

  it("keeps double separators only at the start (UNC)", () => {
    expect(sanitizePath("\\\\a\\b//c\\d")).toBe("//a/b/c/d");
  });
});

describe("isPathSanitized", () => {
  it.each([
    ["", true],
    ["/", true],
    ["/foo", true],
    ["/foo/bar", true],
    ["/foo/bar.txt", true],
    ["foo", true],
    ["foo/bar", true],
    ["foo/", false],
    ["foo/bar/", false],
    ["/foo/", false],
    ["/            ", false],
    ["C:/", true],
    ["C:/foo", true],
    ["C:/foo/bar", true],
    ["C:/foo/bar.txt", true],
    ["C:/foo/", false],
    ["//Server/share/", true],
    ["//Server/share", false],
    ["//Server/share/x", true],
    ["//Server/share/x/", false],
    ["C:\\", false],
    ["C:\\foo", false],
    ["C:\\foo\\", false],
    ["C:\\\\foo", false],
    ["foo\\bar", false],
  ])('"%s" -> %s', (input, expected) => {
    expect(isPathSanitized(input)).toBe(expected);
  });

  it("throws when the path cannot be parsed as a root", () => {
    // "//Server" is a malformed UNC root
    expect(() => isPathSanitized("//Server")).toThrow(VortexError);
  });

  it("throws on invalid characters", () => {
    expect(() => isPathSanitized("\uFFFD")).toThrow(VortexError);
    expect(() => isPathSanitized("foo\uFFFEbar")).toThrow(VortexError);
    expect(() => isPathSanitized("foo\uFFFFbar")).toThrow(VortexError);
  });
});

describe("getRootLength", () => {
  it.each([
    ["/", 1],
    ["/foo", 1],
    ["/foo/", 1],
    ["/foo/bar", 1],
    ["foo", -1],
    ["foo/bar", -1],
    ["C:/", 3],
    ["C:/foo", 3],
    ["C:/foo/", 3],
    ["C:/foo/bar", 3],
    ["//Server/share", 14],
    ["//Server/share/", 15],
    ["//Server/share/x", 15],
  ])('"%s" -> %s', (path, expectedRootLength) => {
    expect(getRootLength(path)).toBe(expectedRootLength);
  });
});

describe("isRooted", () => {
  it.each([
    ["/", true],
    ["/foo", true],
    ["/foo/", true],
    ["/foo/bar", true],
    ["foo", false],
    ["foo/bar", false],
    ["C:/", true],
    ["C:/foo", true],
    ["C:/foo/", true],
    ["C:/foo/bar", true],
  ])('"%s" -> %s', (input, expected) => {
    expect(isRooted(input)).toBe(expected);
  });
});

describe("isRootDirectory", () => {
  it.each([
    ["/", true],
    ["/foo", false],
    ["/foo/", false],
    ["/foo/bar", false],
    ["foo", false],
    ["foo/bar", false],
    ["C:/", true],
    ["C:/foo", false],
    ["C:/foo/", false],
    ["C:/foo/bar", false],
    ["//Server/share", true],
    ["//Server/share/", true],
    ["//Server/share/x", false],
  ])('"%s" -> %s', (input, expected) => {
    expect(isRootDirectory(input)).toBe(expected);
  });
});

describe("isValidWindowsDriveChar", () => {
  it.each([
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => [c, true] as const),
    ..."abcdefghijklmnopqrstuvwxyz".split("").map((c) => [c, true] as const),
    ..."0123456789".split("").map((c) => [c, false] as const),
  ])('"%s" -> %s', (value, expected) => {
    expect(isValidWindowsDriveChar(value)).toBe(expected);
  });

  it.each(["aa", "", "@", "["])('"%s" is invalid', (value) => {
    expect(isValidWindowsDriveChar(value)).toBe(false);
  });
});

describe("parseNativePath", () => {
  it.each([
    ["C:\\Users\\alice\\file.txt", "C:/Users/alice/file.txt", "DOS"],
    ["/home/alice/file.txt", "/home/alice/file.txt", "Unix"],
    ["\\\\Server\\share\\file.txt", "//Server/share/file.txt", "UNC"],
    ["file.txt", "file.txt", "None"],
  ])('"%s" -> "%s" (%s)', (input, expectedPath, expectedType) => {
    const parsed = parseNativePath(input);
    expect(parsed.normalizedPath).toBe(expectedPath);
    expect(parsed.root.type).toBe(expectedType);
  });

  it("throws on invalid input", () => {
    expect(() => parseNativePath("1:/foo")).toThrow(VortexError);
  });
});
