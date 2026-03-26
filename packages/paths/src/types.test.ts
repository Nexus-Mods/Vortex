import { describe, test, expect, beforeEach } from "vitest";

import { RelativePath, ResolvedPath, Extension, Anchor } from "./types";

describe("RelativePath", () => {
  describe("normalization", () => {
    test.each([
      ["mods\\skyrim\\data", "mods/skyrim/data"],
      ["/mods/skyrim", "mods/skyrim"],
      ["mods/skyrim/", "mods/skyrim"],
      ["mods//skyrim", "mods/skyrim"],
      ["mods///skyrim", "mods/skyrim"],
      ["", ""],
      ["single", "single"],
    ])("normalizes %s to %s", (input, expected) => {
      expect(RelativePath.make(input)).toBe(expected);
    });
  });

  describe("validation", () => {
    test.each([
      ["../etc/passwd", "starts with .."],
      ["mods/../../etc", "contains parent directory segments"],
      ["C:/Windows", "drive letter"],
      ["C:\\Windows", "drive letter"],
      ["D:\\Games", "drive letter"],
    ])("rejects invalid path: %s (%s)", (input) => {
      expect(() => RelativePath.make(input)).toThrow();
    });
  });

  describe("join", () => {
    test.each([
      [RelativePath.make("mods"), ["skyrim"], "mods/skyrim"],
      [RelativePath.make("mods"), ["skyrim", "data"], "mods/skyrim/data"],
      [RelativePath.EMPTY, ["mods"], "mods"],
      [RelativePath.make("a"), ["b", "c", "d"], "a/b/c/d"],
    ])("join(%s, %s) = %s", (base, segments, expected) => {
      expect(RelativePath.join(base, ...segments)).toBe(expected);
    });

    test("join handles segments containing forward slashes", () => {
      expect(
        RelativePath.join(RelativePath.make("mods"), "skyrim/data", "meshes"),
      ).toBe("mods/skyrim/data/meshes");
    });

    test("join handles segments containing backslashes", () => {
      expect(
        RelativePath.join(RelativePath.make("mods"), "skyrim\\data", "meshes"),
      ).toBe("mods/skyrim/data/meshes");
    });

    test("join handles segments with leading slashes", () => {
      expect(RelativePath.join(RelativePath.make("a"), "/b", "c")).toBe(
        "a/b/c",
      );
    });

    test("join handles segments with trailing slashes", () => {
      expect(RelativePath.join(RelativePath.make("a"), "b/", "c")).toBe(
        "a/b/c",
      );
    });
  });

  describe("dirname", () => {
    test.each([
      ["mods/skyrim/data.esp", "mods/skyrim"],
      ["mods/skyrim", "mods"],
      ["single", ""],
      ["", ""],
    ])("dirname(%s) = %s", (input, expected) => {
      expect(RelativePath.dirname(RelativePath.make(input))).toBe(expected);
    });
  });

  describe("basename", () => {
    test.each([
      ["mods/skyrim/data.esp", "data.esp"],
      ["mods/skyrim", "skyrim"],
      ["single.txt", "single.txt"],
    ])("basename(%s) = %s", (input, expected) => {
      expect(RelativePath.basename(RelativePath.make(input))).toBe(expected);
    });

    test("basename with extension removal", () => {
      const path = RelativePath.make("mods/skyrim/data.esp");
      expect(RelativePath.basename(path, ".esp")).toBe("data");
    });
  });

  describe("depth", () => {
    test.each([
      ["", 0],
      ["single", 1],
      ["mods/skyrim", 2],
      ["mods/skyrim/data", 3],
      ["a/b/c/d/e", 5],
    ])("depth(%s) = %s", (input, expected) => {
      const rp = input === "" ? RelativePath.EMPTY : RelativePath.make(input);
      expect(RelativePath.depth(rp)).toBe(expected);
    });

    test("depth of EMPTY is 0", () => {
      expect(RelativePath.depth(RelativePath.EMPTY)).toBe(0);
    });
  });

  describe("isIn", () => {
    test("child is in parent", () => {
      const parent = RelativePath.make("mods");
      const child = RelativePath.make("mods/skyrim");
      expect(RelativePath.isIn(child, parent)).toBe(true);
    });

    test("deeply nested child is in parent", () => {
      const parent = RelativePath.make("mods");
      const child = RelativePath.make("mods/skyrim/data/meshes");
      expect(RelativePath.isIn(child, parent)).toBe(true);
    });

    test('equal paths are not "in" each other (strict)', () => {
      const p = RelativePath.make("mods/skyrim");
      expect(RelativePath.isIn(p, p)).toBe(false);
    });

    test("everything is in EMPTY", () => {
      const child = RelativePath.make("mods");
      expect(RelativePath.isIn(child, RelativePath.EMPTY)).toBe(true);
    });

    test("EMPTY is not in EMPTY", () => {
      expect(RelativePath.isIn(RelativePath.EMPTY, RelativePath.EMPTY)).toBe(
        false,
      );
    });

    test("parent is not in child", () => {
      const parent = RelativePath.make("mods");
      const child = RelativePath.make("mods/skyrim");
      expect(RelativePath.isIn(parent, child)).toBe(false);
    });

    test("prefix-but-not-parent does not match", () => {
      const parent = RelativePath.make("mods");
      const notChild = RelativePath.make("mods-extra/skyrim");
      expect(RelativePath.isIn(notChild, parent)).toBe(false);
    });
  });

  describe("equals", () => {
    test("equal paths", () => {
      const a = RelativePath.make("mods/skyrim");
      const b = RelativePath.make("mods/skyrim");
      expect(RelativePath.equals(a, b)).toBe(true);
    });

    test("unequal paths", () => {
      const a = RelativePath.make("mods/skyrim");
      const b = RelativePath.make("mods/oblivion");
      expect(RelativePath.equals(a, b)).toBe(false);
    });

    test("EMPTY equals EMPTY", () => {
      expect(RelativePath.equals(RelativePath.EMPTY, RelativePath.EMPTY)).toBe(
        true,
      );
    });
  });

  describe("compare", () => {
    test("sorts alphabetically", () => {
      const a = RelativePath.make("alpha");
      const b = RelativePath.make("beta");
      expect(RelativePath.compare(a, b)).toBeLessThan(0);
      expect(RelativePath.compare(b, a)).toBeGreaterThan(0);
    });

    test("equal paths compare as 0", () => {
      const a = RelativePath.make("mods/skyrim");
      const b = RelativePath.make("mods/skyrim");
      expect(RelativePath.compare(a, b)).toBe(0);
    });
  });

  describe("hash", () => {
    test("consistent hashing", () => {
      const a = RelativePath.make("mods/skyrim");
      const b = RelativePath.make("mods/skyrim");
      expect(RelativePath.hash(a)).toBe(RelativePath.hash(b));
    });

    test("different paths produce different hashes", () => {
      const a = RelativePath.make("mods/skyrim");
      const b = RelativePath.make("mods/oblivion");
      expect(RelativePath.hash(a)).not.toBe(RelativePath.hash(b));
    });

    test("returns unsigned 32-bit integer", () => {
      const h = RelativePath.hash(RelativePath.make("test"));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(h)).toBe(true);
    });

    test("empty path has a valid hash", () => {
      const h = RelativePath.hash(RelativePath.EMPTY);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("ResolvedPath", () => {
  describe("validation", () => {
    test.each([
      ["/absolute/unix/path"],
      ["/"],
      ["/home/user/documents"],
      ["\\\\server\\share\\mods\\file.txt"],
    ])("accepts absolute path: %s", (input) => {
      expect(() => ResolvedPath.make(input)).not.toThrow();
    });

    test.each([["relative/path"], ["../parent"], [""]])(
      "rejects relative path: %s",
      (input) => {
        expect(() => ResolvedPath.make(input)).toThrow(/absolute/);
      },
    );
  });

  describe("parse", () => {
    test("parses Unix path", () => {
      const path = ResolvedPath.make("/home/user/mods/data.esp");
      const parsed = ResolvedPath.parse(path);

      expect(parsed.root).toBe("/");
      expect(parsed.dir).toBe("/home/user/mods");
      expect(parsed.base).toBe("data.esp");
      expect(parsed.ext).toBe(".esp");
      expect(parsed.name).toBe("data");
    });

    test("parses UNC path", () => {
      const path = ResolvedPath.make("\\\\server\\share\\mods\\data.esp");
      const parsed = ResolvedPath.parse(path);

      expect(parsed.root).toBe("\\\\server\\share\\");
      expect(parsed.dir).toBe("\\\\server\\share\\mods");
      expect(parsed.base).toBe("data.esp");
      expect(parsed.ext).toBe(".esp");
      expect(parsed.name).toBe("data");
    });
  });

  describe("operations", () => {
    test("join", () => {
      const base = ResolvedPath.make("/home/user");
      const joined = ResolvedPath.join(base, "mods", "skyrim");

      expect(joined).toContain("mods");
      expect(joined).toContain("skyrim");
    });

    test("dirname", () => {
      const path = ResolvedPath.make("/home/user/mods/skyrim");
      const parent = ResolvedPath.dirname(path);

      expect(parent).toMatch(/mods$/);
    });

    test("basename", () => {
      const path = ResolvedPath.make("/home/user/mods/data.esp");
      expect(ResolvedPath.basename(path)).toBe("data.esp");
      expect(ResolvedPath.basename(path, ".esp")).toBe("data");
    });

    test("relative", () => {
      const from = ResolvedPath.make("/home/user/mods");
      const to = ResolvedPath.make("/home/user/downloads");
      const relative = ResolvedPath.relative(from, to);

      expect(relative).toBe("../downloads");
    });

    test("handles UNC dirname and basename", () => {
      const path = ResolvedPath.make("\\\\server\\share\\mods\\data.esp");

      expect(ResolvedPath.dirname(path)).toBe("\\\\server\\share\\mods");
      expect(ResolvedPath.basename(path)).toBe("data.esp");
      expect(ResolvedPath.basename(path, ".esp")).toBe("data");
    });

    test("normalizes UNC path", () => {
      const path = ResolvedPath.make(
        "\\\\server\\share\\mods\\..\\downloads\\file.txt",
      );

      expect(ResolvedPath.normalize(path)).toBe(
        "\\\\server\\share\\downloads\\file.txt",
      );
    });

    test("computes relative path for UNC paths", () => {
      const from = ResolvedPath.make("\\\\server\\share\\mods");
      const to = ResolvedPath.make("\\\\server\\share\\mods\\file.txt");

      expect(ResolvedPath.relative(from, to)).toBe("file.txt");
    });
  });
});

describe("Extension", () => {
  describe("make", () => {
    test.each([
      [".png", ".png"],
      [".PNG", ".png"],
      [".dll", ".dll"],
      [".DLL", ".dll"],
    ])("make(%s) = %s (normalized)", (input, expected) => {
      expect(Extension.make(input)).toBe(expected);
    });
  });

  describe("validation", () => {
    test.each([
      ["png", "no dot"],
      [".png/file", "contains separator"],
      [".png\\file", "contains separator"],
      ["", "empty"],
    ])("rejects invalid extension: %s (%s)", (input) => {
      expect(() => Extension.make(input)).toThrow();
    });
  });

  describe("fromPath", () => {
    test.each([
      ["icon.png", ".png"],
      ["game.exe", ".exe"],
      ["data.tar.gz", ".gz"],
      ["UPPERCASE.DLL", ".dll"],
    ])("fromPath(%s) = %s", (input, expected) => {
      expect(Extension.fromPath(input)).toBe(expected);
    });

    test.each([["noext"], ["directory/"], [""]])(
      "fromPath(%s) = undefined (no extension)",
      (input) => {
        expect(Extension.fromPath(input)).toBeUndefined();
      },
    );
  });

  describe("matches", () => {
    test("matches extension", () => {
      const png = Extension.make(".png");
      expect(Extension.matches(png, "icon.png")).toBe(true);
      expect(Extension.matches(png, "icon.jpg")).toBe(false);
    });
  });

  describe("common extensions", () => {
    test("predefined extensions", () => {
      expect(Extension.ESP).toBe(".esp");
      expect(Extension.ESM).toBe(".esm");
      expect(Extension.DLL).toBe(".dll");
      expect(Extension.EXE).toBe(".exe");
      expect(Extension.JSON).toBe(".json");
    });
  });
});

describe("Anchor", () => {
  describe("make and name", () => {
    test("creates and names anchor", () => {
      const anchor = Anchor.make("userData");
      expect(Anchor.name(anchor)).toBe("userData");
    });

    test("interning works", () => {
      const a1 = Anchor.make("userData");
      const a2 = Anchor.make("userData");
      expect(a1).toBe(a2);
    });
  });

  describe("toString", () => {
    test("formats anchor string", () => {
      const anchor = Anchor.make("userData");
      expect(Anchor.toString(anchor)).toBe("Anchor[userData]");
    });
  });

  describe("isAnchor", () => {
    test("validates anchor symbols", () => {
      const anchor = Anchor.make("userData");
      expect(Anchor.isAnchor(anchor)).toBe(true);

      expect(Anchor.isAnchor(Symbol("not-an-anchor"))).toBe(false);
      expect(Anchor.isAnchor("string")).toBe(false);
      expect(Anchor.isAnchor(42)).toBe(false);
      expect(Anchor.isAnchor(null)).toBe(false);
    });
  });
});
