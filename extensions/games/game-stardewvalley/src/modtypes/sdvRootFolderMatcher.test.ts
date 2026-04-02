import { describe, expect, test } from "vitest";

import { isSdvRootFolderModType } from "./sdvRootFolderMatcher";

describe("modtypes/sdvRootFolderMatcher", () => {
  test("matches mixed root-folder installs with case-insensitive manifest detection", async () => {
    await expect(
      isSdvRootFolderModType([
        {
          type: "copy",
          destination: "Content/Data/Fish.xnb",
        },
        {
          type: "copy",
          destination: "Mods/Helper/MANIFEST.JSON",
        },
      ] as any),
    ).resolves.toBe(true);
  });

  test("matches pure Content installs without requiring a manifest", async () => {
    await expect(
      isSdvRootFolderModType([
        {
          type: "copy",
          destination: "Content/Maps/Town.xnb",
        },
      ] as any),
    ).resolves.toBe(true);
  });

  test("does not match manifest-only SMAPI style installs", async () => {
    await expect(
      isSdvRootFolderModType([
        {
          type: "copy",
          destination: "Mods/Helper/manifest.json",
        },
      ] as any),
    ).resolves.toBe(false);
  });

  test("ignores invalid copy destinations instead of throwing", async () => {
    await expect(
      isSdvRootFolderModType([
        {
          type: "copy",
          destination: "C:\\temp\\manifest.json",
        },
        {
          type: "copy",
          destination: "/tmp/Content/Maps/Town.xnb",
        },
      ] as any),
    ).resolves.toBe(false);
  });
});
