import { describe, it, expect } from "vitest";

import { VortexError } from "../errors/base";
import { QualifiedPath, relativePath } from "./paths";

describe("QualifiedPath.of", () => {
  it.each([
    [{ scheme: "foo", data: "", path: "bar/baz", root: "" }, "foo://bar/baz"],
    [{ scheme: "foo", data: "bar", path: "baz", root: "" }, "foo://bar//baz"],
    [{ scheme: "foo", data: "bar", path: "baz/qux", root: "" }, "foo://bar//baz/qux"],
    [
      { scheme: "1", data: "2//3//4//5//6//7//8", path: "9", root: "" },
      "1://2//3//4//5//6//7//8//9",
    ],
    [
      { scheme: "native", data: "", path: "C:/Users/alice", root: "C:/" },
      "native://C:/Users/alice",
    ],
    [{ scheme: "native", data: "", path: "/home/alice", root: "/" }, "native:///home/alice"],
    [
      { scheme: "native", data: "", path: "//server/share/x", root: "//server/share/" },
      "native:////server/share/x",
    ],
    [{ scheme: "native", data: "", path: "//?/C:/x", root: "//?/C:/" }, "native:////?/C:/x"],
  ])("of(%j) → %j", (fields, expectedValue) => {
    const path = QualifiedPath.of(fields);
    expect(path.value).toBe(expectedValue);
    expect(path.scheme).toBe(fields.scheme);
    expect(path.data).toBe(fields.data);
    expect(path.path).toBe(fields.path);
    expect(path.root).toBe(fields.root);
  });

  it("round-trips through the wire format", () => {
    const original = QualifiedPath.fromNative("C:\\Users\\alice");
    const wire = original.toWire();
    expect(wire).toEqual({ scheme: "native", data: "", path: "C:/Users/alice", root: "C:/" });
    expect(QualifiedPath.of(wire).value).toBe(original.value);
    expect(QualifiedPath.of(wire).root).toBe(original.root);
  });

  it("throws on an empty scheme", () => {
    expect(() => QualifiedPath.of({ scheme: "", data: "", path: "x", root: "" })).toThrow(
      VortexError,
    );
  });

  it("throws when root is not a canonical prefix of the path", () => {
    expect(() =>
      QualifiedPath.of({ scheme: "foo", data: "", path: "bar/baz", root: "foo" }),
    ).toThrow(VortexError);
    // the root span must end at a separator or be the whole path
    expect(() =>
      QualifiedPath.of({ scheme: "native", data: "", path: "C:/Users", root: "C:" }),
    ).toThrow(VortexError);
  });

  // Unrooted paths cannot be created by fromNative: they only exist as
  // of-reconstructed paths (the escape hatch), so their behavior is tested here.
  describe("unrooted paths", () => {
    it.each([
      [{ scheme: "foo", data: "bar", path: "baz/qux/quux" }, "foo://bar//baz/qux"],
      [{ scheme: "foo", data: "bar", path: "baz/qux" }, "foo://bar//baz"],
      [{ scheme: "foo", data: "bar", path: "baz" }, "foo://bar//"],
      [{ scheme: "foo", data: "", path: "baz/qux" }, "foo://baz"],
      [{ scheme: "foo", data: "", path: "baz" }, "foo://"],
      [{ scheme: "foo", data: "", path: "" }, "foo://"],
    ])("parent(%j) → %j", (fields, expected) => {
      expect(QualifiedPath.of({ ...fields, root: "" }).parent().value).toBe(expected);
    });

    it("returns the same instance at the top", () => {
      const path = QualifiedPath.of({ scheme: "foo", data: "", path: "", root: "" });
      expect(path.parent()).toBe(path);
    });

    it.each([
      [{ scheme: "foo", data: "bar", path: "baz" }, ["qux"], "foo://bar//baz/qux", "baz/qux"],
      [
        { scheme: "foo", data: "bar", path: "baz" },
        ["qux", "quux"],
        "foo://bar//baz/qux/quux",
        "baz/qux/quux",
      ],
      [{ scheme: "foo", data: "bar", path: "" }, ["baz"], "foo://bar//baz", "baz"],
      [{ scheme: "foo", data: "", path: "" }, ["baz"], "foo://baz", "baz"],
      [{ scheme: "foo", data: "", path: "baz" }, ["qux"], "foo://baz/qux", "baz/qux"],
    ])("join(%j, %j) → %j", (fields, components, expectedValue, expectedPath) => {
      const joined = QualifiedPath.of({ ...fields, root: "" }).join(...components);
      expect(joined.value).toBe(expectedValue);
      expect(joined.path).toBe(expectedPath);
    });

    it("returns the same instance when joining nothing", () => {
      const path = QualifiedPath.of({ scheme: "foo", data: "bar", path: "baz", root: "" });
      expect(path.join()).toBe(path);
    });

    it.each([
      [
        { scheme: "foo", data: "bar", path: "baz/qux.ts" },
        { extension: "js" },
        "foo://bar//baz/qux.js",
      ],
      [{ scheme: "foo", data: "bar", path: "baz/qux.ts" }, { extension: "" }, "foo://bar//baz/qux"],
      [
        { scheme: "foo", data: "bar", path: "baz/qux" },
        { extension: "ts" },
        "foo://bar//baz/qux.ts",
      ],
      [
        { scheme: "foo", data: "bar", path: "baz/qux.ts" },
        { basename: "quux.ts" },
        "foo://bar//baz/quux.ts",
      ],
      [
        { scheme: "foo", data: "bar", path: "baz/qux" },
        { basename: "quux" },
        "foo://bar//baz/quux",
      ],
      [
        { scheme: "foo", data: "bar", path: "baz/qux.ts" },
        { dirname: "other" },
        "foo://bar//other/qux.ts",
      ],
      [{ scheme: "foo", data: "bar", path: "baz/qux.ts" }, { dirname: "" }, "foo://bar//qux.ts"],
      [
        { scheme: "foo", data: "bar", path: "baz/qux.ts" },
        { basename: "quux", extension: "js" },
        "foo://bar//baz/quux.js",
      ],
      [
        { scheme: "foo", data: "bar", path: "baz/qux.ts" },
        { dirname: "other", basename: "quux.ts" },
        "foo://bar//other/quux.ts",
      ],
      [
        { scheme: "foo", data: "bar", path: "baz/qux.ts" },
        { dirname: "", basename: "quux.js", extension: "mjs" },
        "foo://bar//quux.mjs",
      ],
      [{ scheme: "foo", data: "", path: "baz/qux.ts" }, { extension: "js" }, "foo://baz/qux.js"],
      [{ scheme: "foo", data: "", path: "baz/qux.ts" }, { dirname: "" }, "foo://qux.ts"],
    ])("with(%j, %j) → %j", (fields, change, expected) => {
      expect(QualifiedPath.of({ ...fields, root: "" }).with(change).value).toBe(expected);
    });

    it("returns the same instance when changing nothing", () => {
      const path = QualifiedPath.of({ scheme: "foo", data: "bar", path: "baz/qux.ts", root: "" });
      expect(path.with({})).toBe(path);
    });

    it.each([
      [{ scheme: "foo", data: "bar", path: "baz/qux.ts" }, "ts"],
      [{ scheme: "foo", data: "bar", path: "baz/qux.d.ts" }, "ts"],
      [{ scheme: "foo", data: "bar", path: "baz/qux" }, ""],
      [{ scheme: "foo", data: "bar", path: "baz/.hidden" }, "hidden"],
      [{ scheme: "foo", data: "", path: "bar/baz.txt" }, "txt"],
    ])("extension(%j) → %j", (fields, expected) => {
      expect(QualifiedPath.of({ ...fields, root: "" }).extension).toBe(expected);
    });

    it.each([
      [{ scheme: "foo", data: "bar", path: "baz/qux.ts" }, "qux.ts"],
      [{ scheme: "foo", data: "bar", path: "baz/qux.d.ts" }, "qux.d.ts"],
      [{ scheme: "foo", data: "bar", path: "baz/qux" }, "qux"],
      [{ scheme: "foo", data: "bar", path: "baz/.hidden" }, ".hidden"],
      [{ scheme: "foo", data: "", path: "bar/baz.txt" }, "baz.txt"],
      [{ scheme: "foo", data: "bar", path: "baz" }, "baz"],
    ])("basename(%j) → %j", (fields, expected) => {
      expect(QualifiedPath.of({ ...fields, root: "" }).basename).toBe(expected);
    });

    it.each([
      [{ scheme: "foo", data: "bar", path: "baz/qux.ts" }, "baz"],
      [{ scheme: "foo", data: "bar", path: "baz/qux/quux.ts" }, "baz/qux"],
      [{ scheme: "foo", data: "bar", path: "baz" }, ""],
      [{ scheme: "foo", data: "", path: "bar/baz.txt" }, "bar"],
    ])("dirname(%j) → %j", (fields, expected) => {
      expect(QualifiedPath.of({ ...fields, root: "" }).dirname).toBe(expected);
    });

    it.each([
      [{ scheme: "foo", data: "bar", path: "baz/qux" }, ["baz", "qux"]],
      [{ scheme: "foo", data: "bar", path: "a/b/c" }, ["a", "b", "c"]],
      [{ scheme: "foo", data: "bar", path: "single" }, ["single"]],
      [{ scheme: "foo", data: "", path: "baz" }, ["baz"]],
      [{ scheme: "1", data: "2//3//4//5//6//7//8", path: "9" }, ["9"]],
    ])("components(%j) → %j", (fields, expected) => {
      expect(
        QualifiedPath.of({ ...fields, root: "" })
          .components()
          .toArray(),
      ).toEqual(expected);
    });
  });
});

describe("QualifiedPath.extension", () => {
  it.each([
    ["C:\\Users\\file.txt", "txt"],
    ["C:\\", ""],
    ["\\\\server\\share\\file.txt", "txt"],
  ])('fromNative("%s").extension → "%s"', (raw, expected) => {
    expect(QualifiedPath.fromNative(raw).extension).toBe(expected);
  });
});

describe("QualifiedPath.basename", () => {
  it.each([
    ["C:\\Users", "Users"],
    ["C:\\", ""],
    ["\\\\server\\share\\file.txt", "file.txt"],
  ])('fromNative("%s").basename → "%s"', (raw, expected) => {
    expect(QualifiedPath.fromNative(raw).basename).toBe(expected);
  });
});

describe("QualifiedPath.dirname", () => {
  it.each([
    ["C:\\Users\\alice", "C:/Users"],
    ["C:\\Users", "C:/"],
    ["C:\\", ""],
    ["\\\\server\\share\\file.txt", "//server/share/"],
  ])('fromNative("%s").dirname → "%s"', (raw, expected) => {
    expect(QualifiedPath.fromNative(raw).dirname).toBe(expected);
  });
});

describe("QualifiedPath.components", () => {
  it.each([
    ["C:\\Users\\alice", ["Users", "alice"]],
    ["/", []],
    ["\\\\server\\share\\x", ["x"]],
  ])('fromNative("%s").components() → %j', (raw, expected) => {
    expect(QualifiedPath.fromNative(raw).components().toArray()).toEqual(expected);
  });
});

describe("QualifiedPath.parent", () => {
  it.each([
    // roots are their own parent
    ["C:\\", "native://C:/"],
    ["/", "native:///"],
    ["\\\\server\\share\\", "native:////server/share/"],
    ["\\\\?\\C:\\", "native:////?/C:/"],
    // one component above the root resolves to the root
    ["C:\\Users", "native://C:/"],
    ["/home", "native:///"],
    ["\\\\server\\share\\file.txt", "native:////server/share/"],
    ["\\\\?\\C:\\x", "native:////?/C:/"],
    // regular parents
    ["C:\\Users\\alice", "native://C:/Users"],
    ["/home/alice", "native:///home"],
  ])('parent(fromNative("%s")) → "%s"', (raw, expected) => {
    expect(QualifiedPath.fromNative(raw).parent().value).toBe(expected);
  });

  it("returns the same instance for native roots", () => {
    const path = QualifiedPath.fromNative("C:\\");
    expect(path.parent()).toBe(path);
  });
});

describe("QualifiedPath.join", () => {
  it.each([
    ["C:\\", ["Users"], "native://C:/Users", "C:/Users"],
    ["/", ["home"], "native:///home", "/home"],
    ["\\\\server\\share\\", ["x"], "native:////server/share/x", "//server/share/x"],
  ])('join(fromNative("%s"), %j) → "%s"', (raw, components, expectedValue, expectedPath) => {
    const joined = QualifiedPath.fromNative(raw).join(...components);
    expect(joined.value).toBe(expectedValue);
    expect(joined.path).toBe(expectedPath);
  });

  it("returns same instance with no components", () => {
    const path = QualifiedPath.fromNative("C:\\Users\\alice");
    expect(path.join()).toBe(path);
  });
});

describe("QualifiedPath.with", () => {
  it.each([
    ["C:\\Users\\file.ts", { extension: "js" }, "native://C:/Users/file.js"],
    ["C:\\Users\\file.ts", { basename: "quux.ts" }, "native://C:/Users/quux.ts"],
    ["C:\\Users\\file.ts", { dirname: "other" }, "native://C:/other/file.ts"],
    ["C:\\Users\\file.ts", { dirname: "" }, "native://C:/file.ts"],
    ["\\\\server\\share\\file.ts", { extension: "json" }, "native:////server/share/file.json"],
  ])('with(fromNative("%s"), %j) → "%s"', (raw, change, expected) => {
    expect(QualifiedPath.fromNative(raw).with(change).value).toBe(expected);
  });

  it("returns same instance when no changes", () => {
    const path = QualifiedPath.fromNative("C:\\Users\\file.ts");
    expect(path.with({})).toBe(path);
  });
});

describe("QualifiedPath.fromNative", () => {
  it.each([
    ["\\\\?\\C:\\x", "native:////?/C:/x"],
    [
      "\\\\.\\Volume{b75e2c83-0000-0000-0000-602f00000000}\\",
      "native:////./Volume{b75e2c83-0000-0000-0000-602f00000000}/",
    ],
  ])('"%s" → "%s"', (raw, expected) => {
    expect(QualifiedPath.fromNative(raw).value).toBe(expected);
  });

  it("sanitizes duplicate separators and trailing whitespace", () => {
    expect(QualifiedPath.fromNative("C:\\\\Users\\\\alice\\\\").value).toBe(
      "native://C:/Users/alice",
    );
    expect(QualifiedPath.fromNative("/home/alice ").value).toBe("native:///home/alice");
  });

  it("keeps the trailing slash of root directories", () => {
    expect(QualifiedPath.fromNative("C:\\").value).toBe("native://C:/");
    expect(QualifiedPath.fromNative("/").value).toBe("native:///");
    expect(QualifiedPath.fromNative("\\\\server\\share\\").value).toBe("native:////server/share/");
    // the bare volume is a root, too: both spellings canonicalize to the
    // trailing-separator form
    expect(QualifiedPath.fromNative("\\\\server\\share").value).toBe("native:////server/share/");
  });

  it("sets the root field to the sanitized root span", () => {
    expect(QualifiedPath.fromNative("C:\\Users\\alice").root).toBe("C:/");
    expect(QualifiedPath.fromNative("/home/alice").root).toBe("/");
    expect(QualifiedPath.fromNative("\\\\server\\share\\file.txt").root).toBe("//server/share/");
    expect(QualifiedPath.fromNative("\\\\?\\C:\\x").root).toBe("//?/C:/");
  });

  it("uses the native scheme with empty data", () => {
    const path = QualifiedPath.fromNative("C:\\Users\\alice");
    expect(path.scheme).toBe("native");
    expect(path.data).toBe("");
    expect(path.path).toBe("C:/Users/alice");
  });

  it("rejects unrooted inputs", () => {
    expect(() => QualifiedPath.fromNative("foo/bar")).toThrow(VortexError);
    expect(() => QualifiedPath.fromNative("")).toThrow(VortexError);
  });
});

describe("QualifiedPath.compare / equals", () => {
  it("compares different paths case-insensitively", () => {
    const a = QualifiedPath.fromNative("C:/TMP");
    const b = QualifiedPath.fromNative("C:/Users");
    expect(QualifiedPath.compare(a, b)).toBeLessThan(0);
    expect(QualifiedPath.compare(b, a)).toBeGreaterThan(0);
    expect(QualifiedPath.equals(a, b)).toBe(false);
  });

  it("distinguishes different schemes", () => {
    // the steam path needs the of escape hatch: only native paths can be
    // created from raw strings
    expect(
      QualifiedPath.equals(
        QualifiedPath.fromNative("C:/Users"),
        QualifiedPath.of({ scheme: "steam", data: "", path: "C:/Users", root: "C:/" }),
      ),
    ).toBe(false);
  });

  it("sorts deterministically", () => {
    const a = QualifiedPath.fromNative("C:/b");
    const b = QualifiedPath.fromNative("C:/a");
    expect(QualifiedPath.compare(a, b)).toBe(1);
    expect(QualifiedPath.compare(a, a)).toBe(0);
  });
});

describe("relativePath", () => {
  it.each([
    ["foo/bar.txt", "foo/bar.txt"],
    ["foo", "foo"],
    ["foo/bar/baz.txt", "foo/bar/baz.txt"],
  ])('"%s" → "%s"', (input, expected) => {
    expect(relativePath(input)).toBe(expected);
  });

  it("normalizes backslashes to forward slashes", () => {
    expect(relativePath("foo\\bar\\baz.txt")).toBe("foo/bar/baz.txt");
  });

  it("trims a trailing slash", () => {
    expect(relativePath("foo/bar/")).toBe("foo/bar");
  });

  it("collapses repeated separators", () => {
    expect(relativePath("foo//bar///baz")).toBe("foo/bar/baz");
  });

  it.each([
    ["/foo/bar", "leading slash"],
    ["C:/Users/me", "drive letter"],
    ["c:\\Users\\me", "drive letter (backslash, lowercase)"],
    ["foo/../bar", ".. segment"],
    ["../foo", ".. segment at start"],
    ["foo/..", ".. segment at end"],
  ])('rejects "%s" (%s)', (input) => {
    expect(() => relativePath(input)).toThrow(VortexError);
  });
});
