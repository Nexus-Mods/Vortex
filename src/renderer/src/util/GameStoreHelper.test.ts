import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureQueryData = vi.fn();
const getNormalizeFunc = vi.fn();
const regGetValue = vi.fn();
const regEnumKeys = vi.fn();
const withRegOpen = vi.fn();
const opn = vi.fn();

vi.mock("./queryClient", () => ({
  getQueryClient: () => ({
    ensureQueryData,
  }),
}));

vi.mock("./getNormalizeFunc", () => ({
  default: getNormalizeFunc,
}));

vi.mock("./log", () => ({
  log: vi.fn(),
}));

vi.mock("./fs", () => ({
  statAsync: vi.fn(),
}));

vi.mock("./opn", () => ({
  default: opn,
}));

vi.mock("winapi-bindings", () => ({
  RegGetValue: regGetValue,
  GetProcessList: vi.fn(() => []),
  RegEnumKeys: regEnumKeys,
  WithRegOpen: withRegOpen,
}));

describe("GameStoreHelper", () => {
  beforeEach(() => {
    ensureQueryData.mockReset();
    getNormalizeFunc.mockReset();
    regGetValue.mockReset();
    regEnumKeys.mockReset();
    withRegOpen.mockReset();
    opn.mockReset();
    getNormalizeFunc.mockResolvedValue((input: string) => input.toLowerCase());
  });

  it("finds a store entry by installation path from query data", async () => {
    ensureQueryData.mockResolvedValue([
      {
        store_type: "steam",
        store_id: "489830",
        install_path: "C:/Games/Skyrim",
        name: "Skyrim Special Edition",
        store_metadata: JSON.stringify({ lastUpdated: 1700000000000 }),
      },
    ]);

    const GameStoreHelper = (await import("./GameStoreHelper.js")).default as any;

    await expect(
      GameStoreHelper.findByPath("c:/games/skyrim", "steam"),
    ).resolves.toMatchObject({
      appid: "489830",
      gamePath: "C:/Games/Skyrim",
      gameStoreId: "steam",
      name: "Skyrim Special Edition",
      lastUpdated: new Date(1700000000000),
    });

    expect(ensureQueryData).toHaveBeenCalledWith("all_store_games", {});
  });

  it("supplements query-backed results with live registry lookups", async () => {
    ensureQueryData.mockResolvedValue([
      {
        store_type: "steam",
        store_id: "377160",
        install_path: "C:/Games/Fallout4",
        name: "Fallout 4",
        store_metadata: null,
      },
    ]);
    regGetValue.mockReturnValue({
      value: "D:/Games/Fallout4",
      type: "REG_SZ",
    });

    const GameStoreHelper = (await import("./GameStoreHelper.js")).default as any;

    await expect(
      GameStoreHelper.find({
        registry: [{ id: "HKEY_LOCAL_MACHINE:SOFTWARE\\Bethesda Softworks\\Fallout4:Installed Path" }],
        steam: [{ id: "377160" }],
      }),
    ).resolves.toMatchObject([
      {
        appid:
          "HKEY_LOCAL_MACHINE:SOFTWARE\\Bethesda Softworks\\Fallout4:Installed Path",
        gamePath: "D:/Games/Fallout4",
        gameStoreId: "registry",
      },
      {
        appid: "377160",
        gamePath: "C:/Games/Fallout4",
        gameStoreId: "steam",
      },
    ]);
  });

  it.skipIf(process.platform !== "win32")("launches gog games through the Galaxy client without a legacy store object", async () => {
    ensureQueryData.mockResolvedValue([
      {
        store_type: "gog",
        store_id: "1495134320",
        install_path: "D:/Games/Witcher3",
        name: "The Witcher 3",
        store_metadata: null,
      },
    ]);
    regGetValue.mockReturnValue({
      value: "C:/Program Files (x86)/GOG Galaxy/GalaxyClient.exe",
      type: "REG_SZ",
    });

    const api = {
      runExecutable: vi.fn().mockResolvedValue(undefined),
    };

    const GameStoreHelper = (await import("./GameStoreHelper.js")).default as any;

    await expect(
      GameStoreHelper.launchGame(api, "gog", "1495134320"),
    ).resolves.toBeUndefined();

    expect(api.runExecutable).toHaveBeenCalledWith(
      "C:/Program Files (x86)/GOG Galaxy/GalaxyClient.exe",
      [
        "/command=runGame",
        "/gameId=1495134320",
        "path=\"D:/Games/Witcher3\"",
      ],
      expect.objectContaining({
        shell: true,
        suggestDeploy: true,
      }),
    );
  });

  it.skipIf(process.platform !== "win32")("launches the xbox store without a legacy store object", async () => {
    withRegOpen.mockImplementation((_hive: string, _path: string, cb: any) => {
      cb("HK");
    });
    regEnumKeys.mockReturnValue([{ key: "Microsoft.GamingApp_8wekyb3d8bbwe" }]);

    const api = {
      runExecutable: vi.fn().mockResolvedValue(undefined),
      translate: vi.fn((input: string) => input),
      showErrorNotification: vi.fn(),
    };

    const GameStoreHelper = (await import("./GameStoreHelper.js")).default as any;

    await expect(
      GameStoreHelper.launchGameStore(api, "xbox", ["Microsoft.Xbox.App"]),
    ).resolves.toBeUndefined();

    expect(api.runExecutable).toHaveBeenCalledWith(
      "explorer.exe",
      ["shell:appsFolder\\Microsoft.GamingApp_8wekyb3d8bbwe!Microsoft.Xbox.App"],
      expect.objectContaining({
        detach: true,
        shell: true,
        suggestDeploy: false,
      }),
    );
  });
});
