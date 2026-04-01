import { describe, expect, test } from "vitest";

import { demuxInstallEntries, isInstallDirectoryEntry } from "./index";

describe("isInstallDirectoryEntry", () => {
  test.each([
    { input: "Content/", expected: true },
    { input: "Content\\", expected: true },
    { input: "Content/Data.xnb", expected: false },
  ])("$input -> $expected", ({ input, expected }) => {
    expect(isInstallDirectoryEntry(input)).toBe(expected);
  });
});

describe("demuxInstallEntries", () => {
  test("separates explicit directories from files and normalizes separators", () => {
    expect(
      demuxInstallEntries([
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

  test("skips invalid entries without disturbing valid ordering", () => {
    expect(
      demuxInstallEntries([
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
});
