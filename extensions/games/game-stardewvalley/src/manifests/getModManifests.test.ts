import { beforeEach, describe, expect, test, vi } from "vitest";

const getModManifestsMocks = vi.hoisted(() => ({
  turbowalk: vi.fn(),
}));

vi.mock(
  "turbowalk",
  () =>
    ({
      default: getModManifestsMocks.turbowalk,
    }) as any,
);

import { getModManifests } from "./getModManifests";

describe("manifests/getModManifests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns manifest paths with case-insensitive basename matching", async () => {
    getModManifestsMocks.turbowalk.mockImplementation(
      async (_modPath: string, cb: (entries: any[]) => void) => {
        cb([
          { filePath: "/mods/ContentPatcher/MANIFEST.JSON" },
          { filePath: "/mods/ContentPatcher/readme.txt" },
          { filePath: "/mods/ContentPatcher/i18n/manifest.json" },
        ]);
      },
    );

    await expect(getModManifests("/mods/ContentPatcher")).resolves.toEqual([
      "/mods/ContentPatcher/MANIFEST.JSON",
      "/mods/ContentPatcher/i18n/manifest.json",
    ]);
    expect(getModManifestsMocks.turbowalk).toHaveBeenCalledWith(
      "/mods/ContentPatcher",
      expect.any(Function),
      {
        skipHidden: false,
        recurse: true,
        skipInaccessible: true,
        skipLinks: true,
      },
    );
  });

  test("returns an empty list when no mod path is provided", async () => {
    await expect(getModManifests(undefined)).resolves.toEqual([]);
    expect(getModManifestsMocks.turbowalk).not.toHaveBeenCalled();
  });
});
