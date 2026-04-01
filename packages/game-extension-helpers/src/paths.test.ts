import type { RelativePath } from "@vortex/paths";
import { describe, expect, expectTypeOf, test } from "vitest";

import { isDirectoryPath, splitPathsByKind, toRelativePaths } from "./paths";

describe("isDirectoryPath", () => {
  test.each([
    ["empty string is not a directory marker", "", false],
    ["single forward slash counts as directory marker", "/", true],
    ["single backslash counts as directory marker", "\\", true],
    ["whitespace-only string is not a directory marker", " ", false],
    ["trailing forward slash marks directory", "Content/", true],
    ["trailing backslash marks directory", "Content\\", true],
    [
      "path ending with separator plus whitespace is not a directory marker",
      "Content/ ",
      false,
    ],
    [
      "file path without trailing separator is not directory",
      "Content/Data.xnb",
      false,
    ],
    [
      "internal separators do not matter without a trailing marker",
      "nested/path/without-marker",
      false,
    ],
    [
      "nested path with trailing separator is a directory marker",
      "nested/path/with-marker/",
      true,
    ],
  ])("%s", (_label, input, expected) => {
    expect(isDirectoryPath(input)).toBe(expected);
  });
});

describe("splitPathsByKind", () => {
  test("returns empty buckets for empty input", () => {
    expect(splitPathsByKind([])).toEqual({ files: [], directories: [] });
  });

  test("separates explicit directories from files and normalizes separators", () => {
    expect(
      splitPathsByKind([
        "SomePack\\Content\\",
        "SomePack\\Content\\Data.xnb",
        "SomePack/Mods/",
        "SomePack\\Mods\\Helper\\manifest.json",
        "SomePack/README.TXT",
      ]),
    ).toEqual({
      files: [
        "SomePack/Content/Data.xnb",
        "SomePack/Mods/Helper/manifest.json",
        "SomePack/README.TXT",
      ],
      directories: ["SomePack/Content", "SomePack/Mods"],
    });
  });

  test("skips invalid entries without disturbing per-bucket ordering", () => {
    expect(
      splitPathsByKind([
        "../escape.txt",
        "Root\\Content\\",
        "Root\\Content\\Data.xnb",
        "C:\\Windows\\system32",
        "Root/Mods/Helper/manifest.json",
      ]),
    ).toEqual({
      files: ["Root/Content/Data.xnb", "Root/Mods/Helper/manifest.json"],
      directories: ["Root/Content"],
    });
  });

  test("uses the trailing marker, not normalized content, to choose the bucket", () => {
    // Both raw inputs normalize to the same string, so the trailing slash alone decides the bucket.
    expect(splitPathsByKind(["Pack/Content/", "Pack/Content"])).toEqual({
      files: ["Pack/Content"],
      directories: ["Pack/Content"],
    });
  });
});

describe("toRelativePaths", () => {
  test("returns an empty array for empty input", () => {
    const result = toRelativePaths([]);

    expectTypeOf(result).toEqualTypeOf<RelativePath[]>();
    expect(result).toEqual([]);
  });

  test("normalizes separators and strips leading separators", () => {
    expect(
      toRelativePaths(["/Pack/Content/Data.xnb", "Pack//Scripts//init.lua/"]),
    ).toEqual(["Pack/Content/Data.xnb", "Pack/Scripts/init.lua"]);
  });

  test("preserves duplicates (files and directories are different entities)", () => {
    // These normalize to the same value, but both are preserved.
    expect(
      toRelativePaths(["/Pack/Content/Data.xnb", "Pack\\Content\\Data.xnb"]),
    ).toEqual(["Pack/Content/Data.xnb", "Pack/Content/Data.xnb"]);
  });

  test("preserves first-seen order", () => {
    expect(
      toRelativePaths(["Pack/B.xnb", "/Pack//A.xnb", "Pack\\A.xnb"]),
    ).toEqual(["Pack/B.xnb", "Pack/A.xnb", "Pack/A.xnb"]);
  });

  test("skips invalid entries while preserving first-seen order", () => {
    expect(
      toRelativePaths([
        "../escape.txt",
        "Pack/meshes/dragon.nif",
        "C:\\Windows\\system32",
        "Pack\\textures\\dragon.dds",
        "Pack/textures/dragon.dds",
      ]),
    ).toEqual([
      "Pack/meshes/dragon.nif",
      "Pack/textures/dragon.dds",
      "Pack/textures/dragon.dds",
    ]);
  });
});
