import { beforeEach, describe, expect, test, vi } from "vitest";

import { GAME_ID } from "../common";

const transitionMocks = vi.hoisted(() => ({
  copyAsync: vi.fn(),
  profileById: vi.fn(),
  installPathForGame: vi.fn(),
  selectSdvMods: vi.fn(),
  initializeConfigMod: vi.fn(),
  extractConfigModAttributes: vi.fn(),
  removeConfigModAttributes: vi.fn(),
  walkPath: vi.fn(),
  deleteFolder: vi.fn(),
  onSyncModConfigurations: vi.fn(),
}));

vi.mock(
  "vortex-api",
  () =>
    ({
      fs: {
        copyAsync: transitionMocks.copyAsync,
      },
      selectors: {
        profileById: transitionMocks.profileById,
        installPathForGame: transitionMocks.installPathForGame,
      },
    }) as any,
);

vi.mock(
  "../state/selectors",
  () =>
    ({
      selectSdvMods: transitionMocks.selectSdvMods,
    }) as any,
);

vi.mock(
  "./lifecycle",
  () =>
    ({
      initializeConfigMod: transitionMocks.initializeConfigMod,
      extractConfigModAttributes: transitionMocks.extractConfigModAttributes,
      removeConfigModAttributes: transitionMocks.removeConfigModAttributes,
    }) as any,
);

vi.mock(
  "./filesystem",
  () =>
    ({
      walkPath: transitionMocks.walkPath,
      deleteFolder: transitionMocks.deleteFolder,
    }) as any,
);

vi.mock(
  "./sync",
  () =>
    ({
      onSyncModConfigurations: transitionMocks.onSyncModConfigurations,
    }) as any,
);

import { onWillEnableModsImpl } from "./transitions";

describe("configMod/transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transitionMocks.copyAsync.mockResolvedValue(undefined);
    transitionMocks.deleteFolder.mockResolvedValue(undefined);
    transitionMocks.profileById.mockReturnValue({
      id: "profile-1",
      gameId: GAME_ID,
    });
    transitionMocks.installPathForGame.mockReturnValue("/game/install");
    transitionMocks.initializeConfigMod.mockResolvedValue({
      mod: { id: "cfg-mod" },
      configModPath: "/game/install/Stardew Valley Configuration",
      profileId: "profile-1",
    });
    transitionMocks.extractConfigModAttributes.mockReturnValue([
      "ContentPatcher",
    ]);
    transitionMocks.selectSdvMods.mockReturnValue({
      ContentPatcher: {
        id: "ContentPatcher",
        installationPath: "ContentPatcher",
      },
    });
    transitionMocks.walkPath.mockResolvedValue([
      { filePath: "/game/install/ContentPatcher/MANIFEST.JSON" },
    ]);
  });

  test("restores config files for tracked mods with uppercase manifest filenames", async () => {
    const api = {
      getState: () => ({}),
      emitAndAwait: vi.fn().mockResolvedValue(undefined),
      showErrorNotification: vi.fn(),
    } as any;

    await onWillEnableModsImpl(api, "profile-1", ["ContentPatcher"], false);

    expect(transitionMocks.copyAsync).toHaveBeenCalledWith(
      "/game/install/Stardew Valley Configuration/config.json",
      "/game/install/ContentPatcher/config.json",
      { overwrite: true },
    );
    expect(transitionMocks.deleteFolder).toHaveBeenCalledWith(
      "/game/install/Stardew Valley Configuration",
    );
    expect(api.emitAndAwait).toHaveBeenNthCalledWith(
      1,
      "deploy-single-mod",
      GAME_ID,
      "cfg-mod",
      false,
    );
    expect(api.emitAndAwait).toHaveBeenNthCalledWith(
      2,
      "deploy-single-mod",
      GAME_ID,
      "cfg-mod",
      true,
    );
    expect(transitionMocks.removeConfigModAttributes).toHaveBeenCalledWith(
      api,
      { id: "cfg-mod" },
      ["ContentPatcher"],
    );
  });
});
