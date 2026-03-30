import GameModeManager from "../GameModeManager";
import { loadStoreGames } from "../util/discoveryQueries";
import { quickDiscovery } from "../util/discovery";

jest.mock("../util/discovery", () => ({
  assertToolDir: jest.fn(),
  discoverRelativeTools: jest.fn(),
  quickDiscovery: jest.fn(),
  quickDiscoveryTools: jest.fn(),
  searchDiscovery: jest.fn(),
}));

jest.mock("../util/discoveryQueries", () => ({
  loadStoreGames: jest.fn(),
}));

describe("GameModeManager", () => {
  it("loads store games through the query helper during quick discovery", async () => {
    const start = jest.fn().mockResolvedValue(undefined);
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

    (loadStoreGames as jest.Mock).mockResolvedValue(storeGames);
    (quickDiscovery as jest.Mock).mockResolvedValue(["skyrimse"]);

    const manager = new GameModeManager(
      {} as never,
      [],
      [],
      [],
      jest.fn(),
    ) as any;

    manager.mStore = {
      dispatch: jest.fn(),
      getState: jest.fn(() => ({
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
