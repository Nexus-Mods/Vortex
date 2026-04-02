import { beforeEach, describe, expect, test, vi } from "vitest";

const cacheMocks = vi.hoisted(() => ({
  installPathForGame: vi.fn(),
  lastActiveProfileForGame: vi.fn(),
  profileById: vi.fn(),
  getModManifests: vi.fn(),
  parseManifest: vi.fn(),
  selectSdvMods: vi.fn(),
  log: vi.fn(),
}));

vi.mock(
  "vortex-api",
  () =>
    ({
      selectors: {
        installPathForGame: cacheMocks.installPathForGame,
        lastActiveProfileForGame: cacheMocks.lastActiveProfileForGame,
        profileById: cacheMocks.profileById,
      },
      util: {
        getSafe: (value: any, path: Array<string | number>, fallback: any) => {
          const result = path.reduce(
            (acc, key) => (acc == null ? undefined : acc[key]),
            value,
          );
          return result === undefined ? fallback : result;
        },
      },
      log: cacheMocks.log,
    }) as any,
);

vi.mock(
  "../state/selectors",
  () =>
    ({
      selectSdvMods: cacheMocks.selectSdvMods,
    }) as any,
);

vi.mock(
  "./getModManifests",
  () =>
    ({
      getModManifests: cacheMocks.getModManifests,
    }) as any,
);

vi.mock(
  "./parseManifest",
  () =>
    ({
      parseManifest: cacheMocks.parseManifest,
    }) as any,
);

import ModManifestCache from "./ModManifestCache";

describe("manifests/ModManifestCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheMocks.installPathForGame.mockReturnValue("/staging");
    cacheMocks.lastActiveProfileForGame.mockReturnValue("profile-1");
    cacheMocks.profileById.mockReturnValue({
      modState: {
        ContentPatcher: { enabled: true },
        InactiveMod: { enabled: false },
      },
    });
  });

  test("scans only active installed mods and accepts uppercase manifest filenames", async () => {
    const manifest = {
      Name: "Content Patcher",
      Author: "Path Tests",
      Version: "1.0.0",
      Description: "test manifest",
      UniqueID: "PathTests.ContentPatcher",
      EntryDll: "ContentPatcher.dll",
      MinimumApiVersion: "4.0.0",
      UpdateKeys: [],
      Dependencies: [],
    };

    cacheMocks.selectSdvMods.mockReturnValue({
      ContentPatcher: {
        id: "ContentPatcher",
        installationPath: "ContentPatcher",
        state: "installed",
      },
      InactiveMod: {
        id: "InactiveMod",
        installationPath: "InactiveMod",
        state: "installed",
      },
      DownloadingMod: {
        id: "DownloadingMod",
        installationPath: "DownloadingMod",
        state: "downloading",
      },
    });
    cacheMocks.getModManifests.mockImplementation(async (modPath: string) => {
      return modPath === "/staging/ContentPatcher"
        ? [
            "/staging/ContentPatcher/MANIFEST.JSON",
            "/staging/ContentPatcher/readme.txt",
          ]
        : [];
    });
    cacheMocks.parseManifest.mockResolvedValue(manifest);

    const cache = new ModManifestCache({
      getState: () => ({}),
    } as any);

    await expect(cache.getManifests()).resolves.toEqual({
      ContentPatcher: [manifest],
    });
    expect(cacheMocks.getModManifests).toHaveBeenCalledTimes(1);
    expect(cacheMocks.getModManifests).toHaveBeenCalledWith(
      "/staging/ContentPatcher",
    );
    expect(cacheMocks.parseManifest).toHaveBeenCalledWith(
      "/staging/ContentPatcher/MANIFEST.JSON",
    );
  });

  test("logs parse failures and continues scanning", async () => {
    cacheMocks.selectSdvMods.mockReturnValue({
      ContentPatcher: {
        id: "ContentPatcher",
        installationPath: "ContentPatcher",
        state: "installed",
      },
    });
    cacheMocks.getModManifests.mockResolvedValue([
      "/staging/ContentPatcher/MANIFEST.JSON",
    ]);
    cacheMocks.parseManifest.mockRejectedValue(new Error("invalid manifest"));

    const cache = new ModManifestCache({
      getState: () => ({}),
    } as any);

    await expect(cache.getManifests()).resolves.toEqual({});
    expect(cacheMocks.log).toHaveBeenCalledWith(
      "error",
      "failed to parse manifest",
      {
        error: "invalid manifest",
        manifest: "/staging/ContentPatcher/MANIFEST.JSON",
      },
    );
  });
});
