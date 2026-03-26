import { describe, expect, test } from "vitest";

import { posix, win32 } from "./pathUtils";

describe("pathUtils root handling", () => {
  // These are roots, not normal paths with a final file name. `/` and `C:\`
  // therefore have an empty basename. `\\server\share` is the Windows odd
  // case: Node's `basename()` returns `share`, but `parse()` still treats the
  // whole input as the UNC root, so `base`, `name`, and `ext` stay empty.
  describe("basename", () => {
    test.each([
      ["posix /", posix, "/", ""],
      ["win32 drive", win32, "C:\\", ""],
      ["win32 UNC", win32, "\\\\server\\share", "share"],
    ])("%s", (_label, pathMod, input, expected) => {
      expect(pathMod.basename(input)).toBe(expected);
    });
  });

  describe("parse", () => {
    test.each([
      ["posix /", posix, "/", { root: "/", dir: "/", base: "", ext: "", name: "" }],
      ["win32 drive", win32, "C:\\", { root: "C:\\", dir: "C:\\", base: "", ext: "", name: "" }],
      [
        "win32 UNC",
        win32,
        "\\\\server\\share",
        {
          root: "\\\\server\\share",
          dir: "\\\\server\\share",
          base: "",
          ext: "",
          name: "",
        },
      ],
    ])("%s", (_label, pathMod, input, expected) => {
      expect(pathMod.parse(input)).toEqual(expected);
    });
  });
});
