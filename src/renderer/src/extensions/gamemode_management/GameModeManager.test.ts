import { describe, expect, it, vi } from "vitest";

vi.mock("../../util/fs", () => ({
  statAsync: vi.fn(),
  mkdirsAsync: vi.fn(),
  ensureDirAsync: vi.fn(),
  readFileAsync: vi.fn(),
  writeFileAsync: vi.fn(),
}));

vi.mock("../../util/GameStoreHelper", () => ({
  default: {
    storeIds: vi.fn(() => []),
    findByPath: vi.fn(),
  },
}));

vi.mock("./util/discovery", () => ({
  assertToolDir: vi.fn(),
  discoverRelativeTools: vi.fn(),
  quickDiscovery: vi.fn(),
  quickDiscoveryTools: vi.fn(),
  searchDiscovery: vi.fn(),
}));

vi.mock("./util/discoveryQueries", () => ({
  loadStoreGames: vi.fn(),
}));

import GameModeManager from "./GameModeManager";
import { loadStoreGames } from "./util/discoveryQueries";
import { quickDiscovery } from "./util/discovery";

describe("GameModeManager", () => {
  it("loads store games through the query helper during quick discovery", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const storeGames = [
      {
        store_type: "steam",
        store_id: "489830",
        install_path: "C:/Games/Skyrim",
        name: "Skyrim Special Edition",
        store_metadata: null,
      },
    ];

    (window as any).api = {
      discovery: { start },
      query: {},
    };

    vi.mocked(loadStoreGames).mockResolvedValue(storeGames);
    vi.mocked(quickDiscovery).mockResolvedValue(["skyrimse"]);

    const manager = new GameModeManager(
      {} as never,
      [],
      [],
      vi.fn(),
    ) as any;

    manager.mStore = {
      dispatch: vi.fn(),
      getState: vi.fn(() => ({
        session: { discovery: { running: false } },
        settings: { gameMode: { discovered: {} } },
      })),
    };

    await expect(manager.startQuickDiscovery()).resolves.toEqual(["skyrimse"]);

    expect(start).toHaveBeenCalledTimes(1);
    expect(loadStoreGames).toHaveBeenCalledWith();
    expect(quickDiscovery).toHaveBeenCalledWith(
      [],
      {},
      expect.any(Function),
      expect.any(Function),
      storeGames,
    );
  });
});
