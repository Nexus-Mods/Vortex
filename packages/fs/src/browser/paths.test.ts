import { describe, it, expect } from "vitest";

import { QualifiedPath, qpath } from "./paths";

describe("QualifiedPath.parse", () => {
  it.each([
    ["foo://bar/baz", "foo", "", "bar/baz"],
    ["foo://bar//baz", "foo", "bar", "baz"],
    ["foo://bar//baz/qux", "foo", "bar", "baz/qux"],
    ["1://2//3//4//5//6//7//8//9", "1", "2//3//4//5//6//7//8", "9"],
    ["foo://baz", "foo", "", "baz"],
  ])('parse("%s")', (input, scheme, data, path) => {
    const qp = QualifiedPath.parse(input);
    expect(qp.scheme).toBe(scheme);
    expect(qp.data).toBe(data);
    expect(qp.path).toBe(path);
  });

  it.each([["no-separator"], ["foo/bar/baz"]])(
    'throws on invalid input "%s"',
    (input) => {
      expect(() => QualifiedPath.parse(input)).toThrow();
    },
  );
});

describe("QualifiedPath.extension", () => {
  it.each([
    ["foo://bar//baz/qux.ts", "ts"],
    ["foo://bar//baz/qux.d.ts", "ts"],
    ["foo://bar//baz/qux", ""],
    ["foo://bar//baz/.hidden", "hidden"],
    ["foo://bar/baz.txt", "txt"],
  ])('"%s" → "%s"', (input, expected) => {
    expect(QualifiedPath.parse(input).extension).toBe(expected);
  });
});

describe("QualifiedPath.basename", () => {
  it.each([
    ["foo://bar//baz/qux.ts", "qux.ts"],
    ["foo://bar//baz/qux.d.ts", "qux.d.ts"],
    ["foo://bar//baz/qux", "qux"],
    ["foo://bar//baz/.hidden", ".hidden"],
    ["foo://bar/baz.txt", "baz.txt"],
    ["foo://bar//baz", "baz"],
  ])('"%s" → "%s"', (input, expected) => {
    expect(QualifiedPath.parse(input).basename).toBe(expected);
  });
});

describe("QualifiedPath.dirname", () => {
  it.each([
    ["foo://bar//baz/qux.ts", "baz"],
    ["foo://bar//baz/qux/quux.ts", "baz/qux"],
    ["foo://bar//baz", ""],
    ["foo://bar/baz.txt", "bar"],
  ])('"%s" → "%s"', (input, expected) => {
    expect(QualifiedPath.parse(input).dirname).toBe(expected);
  });
});

describe("QualifiedPath.components", () => {
  it.each([
    ["foo://bar//baz/qux", ["baz", "qux"]],
    ["foo://bar//a/b/c", ["a", "b", "c"]],
    ["foo://bar//single", ["single"]],
    ["foo://baz", ["baz"]],
    ["1://2//3//4//5//6//7//8//9", ["9"]],
  ])('"%s" → %j', (input, expected) => {
    expect(QualifiedPath.parse(input).components().toArray()).toEqual(expected);
  });

  describe("QualifiedPath.parent", () => {
    it.each([
      ["foo://bar//baz/qux/quux", "foo://bar//baz/qux"],
      ["foo://bar//baz/qux", "foo://bar//baz"],
      ["foo://bar//baz", "foo://bar//"],
      ["foo://baz/qux", "foo://baz"],
      ["foo://baz", "foo://"],
      ["foo://", "foo://"],
    ])('"%s" → "%s"', (input, expected) => {
      const qp = QualifiedPath.parse(input);
      const parent = qp.parent();
      expect(parent.value).toBe(expected);
    });

    it("returns same instance at root", () => {
      const qp = QualifiedPath.parse("foo://");
      expect(qp.parent()).toBe(qp);
    });
  });

  describe("QualifiedPath.join", () => {
    it.each([
      ["foo://bar//baz", ["qux"], "foo://bar//baz/qux", "baz/qux"],
      [
        "foo://bar//baz",
        ["qux", "quux"],
        "foo://bar//baz/qux/quux",
        "baz/qux/quux",
      ],
      ["foo://bar//", ["baz"], "foo://bar//baz", "baz"],
      ["foo://", ["baz"], "foo://baz", "baz"],
      ["foo://baz", ["qux"], "foo://baz/qux", "baz/qux"],
    ])(
      '"%s".join(%j) → "%s"',
      (input, components, expectedValue, expectedPath) => {
        const qp = QualifiedPath.parse(input).join(...components);
        expect(qp.value).toBe(expectedValue);
        expect(qp.path).toBe(expectedPath);
      },
    );

    it("returns same instance with no components", () => {
      const qp = QualifiedPath.parse("foo://bar//baz");
      expect(qp.join()).toBe(qp);
    });
  });

  describe("QualifiedPath.with", () => {
    it.each([
      // change extension
      ["foo://bar//baz/qux.ts", { extension: "js" }, "foo://bar//baz/qux.js"],
      ["foo://bar//baz/qux.ts", { extension: "" }, "foo://bar//baz/qux"],
      ["foo://bar//baz/qux", { extension: "ts" }, "foo://bar//baz/qux.ts"],

      // change basename
      [
        "foo://bar//baz/qux.ts",
        { basename: "quux.ts" },
        "foo://bar//baz/quux.ts",
      ],
      ["foo://bar//baz/qux", { basename: "quux" }, "foo://bar//baz/quux"],

      // change dirname
      [
        "foo://bar//baz/qux.ts",
        { dirname: "other" },
        "foo://bar//other/qux.ts",
      ],
      ["foo://bar//baz/qux.ts", { dirname: "" }, "foo://bar//qux.ts"],

      // change multiple
      [
        "foo://bar//baz/qux.ts",
        { basename: "quux", extension: "js" },
        "foo://bar//baz/quux.js",
      ],
      [
        "foo://bar//baz/qux.ts",
        { dirname: "other", basename: "quux.ts" },
        "foo://bar//other/quux.ts",
      ],
      [
        "foo://bar//baz/qux.ts",
        { dirname: "", basename: "quux.js", extension: "mjs" },
        "foo://bar//quux.mjs",
      ],

      // no data segment
      ["foo://baz/qux.ts", { extension: "js" }, "foo://baz/qux.js"],
      ["foo://baz/qux.ts", { dirname: "" }, "foo://qux.ts"],
    ])('"%s".with(%j) → "%s"', (input, change, expected) => {
      expect(QualifiedPath.parse(input).with(change).value).toBe(expected);
    });

    it("returns same instance when no changes", () => {
      const qp = QualifiedPath.parse("foo://bar//baz/qux.ts");
      expect(qp.with({})).toBe(qp);
    });
  });
});

describe("qpath", () => {
  it("joins segments onto a QualifiedPath base", () => {
    const install = QualifiedPath.parse("steam://SteamApps/common/Skyrim");
    const result = qpath`${install}/engine/config`;
    expect(result.value).toBe("steam://SteamApps/common/Skyrim/engine/config");
  });

  it("handles multiple interpolated values", () => {
    const base = QualifiedPath.parse("linux:///home/user");
    const sub = "games";
    const result = qpath`${base}/${sub}/saves`;
    expect(result.value).toBe("linux:///home/user/games/saves");
  });

  it("parses a plain string with no QualifiedPath base", () => {
    const result = qpath`linux:///home/user/.config`;
    expect(result.scheme).toBe("linux");
    expect(result.path).toBe("/home/user/.config");
  });

  it("returns the base unchanged when no trailing path", () => {
    const base = QualifiedPath.parse("steam://app");
    const result = qpath`${base}`;
    expect(result.value).toBe("steam://app");
  });
});
