import { beforeEach, describe, expect, test, vi } from "vitest";

import { GAME_ID } from "../common";

const syncMocks = vi.hoisted(() => ({
  ensureDirWritableAsync: vi.fn(),
  copyAsync: vi.fn(),
  removeAsync: vi.fn(),
  log: vi.fn(),
  profileById: vi.fn(),
  activeProfile: vi.fn(),
  installPathForGame: vi.fn(),
  discoveryByGame: vi.fn(),
  walkPath: vi.fn(),
  initializeConfigMod: vi.fn(),
  extractConfigModAttributes: vi.fn(),
  setConfigModAttribute: vi.fn(),
  findSMAPITool: vi.fn(),
  getSMAPIMods: vi.fn(),
  selectMergeConfigsEnabled: vi.fn(),
  shouldSuppressSync: vi.fn(),
  isSmapiInternalPath: vi.fn(),
  setMergeConfigs: vi.fn((profileId: string, enabled: boolean) => ({
    profileId,
    enabled,
  })),
}));

vi.mock(
  "vortex-api",
  () =>
    ({
      fs: {
        ensureDirWritableAsync: syncMocks.ensureDirWritableAsync,
        copyAsync: syncMocks.copyAsync,
        removeAsync: syncMocks.removeAsync,
      },
      log: syncMocks.log,
      selectors: {
        profileById: syncMocks.profileById,
        activeProfile: syncMocks.activeProfile,
        installPathForGame: syncMocks.installPathForGame,
        discoveryByGame: syncMocks.discoveryByGame,
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
    }) as any,
);

vi.mock(
  "../smapi/selectors",
  () =>
    ({
      findSMAPITool: syncMocks.findSMAPITool,
      getSMAPIMods: syncMocks.getSMAPIMods,
    }) as any,
);

vi.mock(
  "../state/selectors",
  () =>
    ({
      selectMergeConfigsEnabled: syncMocks.selectMergeConfigsEnabled,
    }) as any,
);

vi.mock(
  "./filesystem",
  () =>
    ({
      walkPath: syncMocks.walkPath,
    }) as any,
);

vi.mock(
  "./lifecycle",
  () =>
    ({
      initializeConfigMod: syncMocks.initializeConfigMod,
      extractConfigModAttributes: syncMocks.extractConfigModAttributes,
      setConfigModAttribute: syncMocks.setConfigModAttribute,
    }) as any,
);

vi.mock(
  "./policy",
  () =>
    ({
      shouldSuppressSync: syncMocks.shouldSuppressSync,
      isSmapiInternalPath: syncMocks.isSmapiInternalPath,
    }) as any,
);

vi.mock(
  "../state/actions",
  () =>
    ({
      setMergeConfigs: (...args: [string, boolean]) =>
        syncMocks.setMergeConfigs(...args),
    }) as any,
);

import { addModConfig, onSyncModConfigurations } from "./sync";

describe("configMod/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncMocks.ensureDirWritableAsync.mockResolvedValue(undefined);
    syncMocks.copyAsync.mockResolvedValue(undefined);
    syncMocks.removeAsync.mockResolvedValue(undefined);
    syncMocks.activeProfile.mockReturnValue({
      id: "profile-1",
      gameId: GAME_ID,
      modState: {},
    });
    syncMocks.profileById.mockImplementation(
      (_state: unknown, profileId: string) => ({
        id: profileId,
        gameId: GAME_ID,
        modState: {},
      }),
    );
    syncMocks.installPathForGame.mockReturnValue("/game/install");
    syncMocks.discoveryByGame.mockReturnValue({ path: "/game" });
    syncMocks.walkPath.mockResolvedValue([]);
    syncMocks.initializeConfigMod.mockResolvedValue({
      mod: { id: "cfg-mod" },
      configModPath: "/staging/Stardew Valley Configuration",
      profileId: "profile-1",
    });
    syncMocks.extractConfigModAttributes.mockReturnValue([]);
    syncMocks.findSMAPITool.mockReturnValue({
      path: "/game/install/StardewModdingAPI",
    });
    syncMocks.getSMAPIMods.mockReturnValue([]);
    syncMocks.selectMergeConfigsEnabled.mockReturnValue(true);
    syncMocks.shouldSuppressSync.mockReturnValue(false);
    syncMocks.isSmapiInternalPath.mockImplementation((filePath: string) =>
      filePath.includes("smapi-internal"),
    );
  });

  test("drops the leading mod id when importing files from the install path", async () => {
    const api = {
      getState: () => ({}),
      sendNotification: vi.fn(),
      dismissNotification: vi.fn(),
      showErrorNotification: vi.fn(),
    } as any;

    await addModConfig(
      api,
      [
        {
          filePath: "/game/install/ContentPatcher/settings/config.json",
          candidates: ["ContentPatcher"],
        },
      ],
      "profile-1",
      "/game/install",
    );

    expect(syncMocks.ensureDirWritableAsync).toHaveBeenCalledWith(
      "/staging/Stardew Valley Configuration/settings",
    );
    expect(syncMocks.copyAsync).toHaveBeenCalledWith(
      "/game/install/ContentPatcher/settings/config.json",
      "/staging/Stardew Valley Configuration/settings/config.json",
      { overwrite: true },
    );
    expect(syncMocks.removeAsync).toHaveBeenCalledWith(
      "/game/install/ContentPatcher/settings/config.json",
    );
    expect(syncMocks.setConfigModAttribute).toHaveBeenCalledWith(
      api,
      "cfg-mod",
      ["ContentPatcher"],
    );
  });

  test("keeps the mod folder when importing files from the game Mods path", async () => {
    syncMocks.discoveryByGame.mockReturnValue({
      path: "/home/sewer/Games/Steam/steamapps/common/Stardew Valley",
    });
    const api = {
      getState: () => ({}),
      sendNotification: vi.fn(),
      dismissNotification: vi.fn(),
      showErrorNotification: vi.fn(),
    } as any;

    await addModConfig(
      api,
      [
        {
          filePath:
            "/home/sewer/Games/Steam/steamapps/common/Stardew Valley/Mods/ContentPatcher/config.json",
          candidates: ["ContentPatcher"],
        },
      ],
      "profile-1",
    );

    expect(syncMocks.copyAsync).toHaveBeenCalledWith(
      "/home/sewer/Games/Steam/steamapps/common/Stardew Valley/Mods/ContentPatcher/config.json",
      "/staging/Stardew Valley Configuration/ContentPatcher/config.json",
      { overwrite: true },
    );
  });

  test("excludes files inside the config mod path but keeps sibling prefix matches", async () => {
    syncMocks.activeProfile.mockReturnValue({
      id: "profile-1",
      gameId: GAME_ID,
      modState: {
        SomeMod: { enabled: true },
        "Stardew Valley Configuration Backup": { enabled: true },
      },
    });
    syncMocks.initializeConfigMod.mockResolvedValue({
      mod: { id: "cfg-mod" },
      configModPath: "/game/install/Stardew Valley Configuration",
      profileId: "profile-1",
    });
    syncMocks.walkPath.mockResolvedValue([
      { filePath: "/game/install/SomeMod/config.json" },
      {
        filePath: "/game/install/Stardew Valley Configuration/config.json",
      },
      {
        filePath:
          "/game/install/Stardew Valley Configuration/nested/config.json",
      },
      {
        filePath:
          "/game/install/Stardew Valley Configuration Backup/settings/config.json",
      },
    ]);

    const api = {
      getState: () => ({}),
      showDialog: vi.fn(),
      showErrorNotification: vi.fn(),
      sendNotification: vi.fn(),
      dismissNotification: vi.fn(),
      store: { dispatch: vi.fn() },
      events: {
        emit: vi.fn((...args: any[]) => {
          const cb = args.at(-1);
          if (typeof cb === "function") {
            cb(null);
          }
        }),
      },
    } as any;

    await onSyncModConfigurations(api, true);

    expect(syncMocks.copyAsync.mock.calls).toEqual([
      [
        "/game/install/SomeMod/config.json",
        "/game/install/Stardew Valley Configuration/config.json",
        { overwrite: true },
      ],
      [
        "/game/install/Stardew Valley Configuration Backup/settings/config.json",
        "/game/install/Stardew Valley Configuration/settings/config.json",
        { overwrite: true },
      ],
    ]);
    expect(api.events.emit).toHaveBeenNthCalledWith(
      1,
      "purge-mods",
      false,
      expect.any(Function),
    );
    expect(api.events.emit).toHaveBeenNthCalledWith(
      2,
      "deploy-mods",
      expect.any(Function),
    );
  });
});
