import { loadStoreGames } from "../util/discoveryQueries";

describe("discoveryQueries", () => {
  it("loads store games from the query client", async () => {
    const ensureQueryData = jest.fn().mockResolvedValue([
      {
        store_type: "steam",
        store_id: "489830",
        install_path: "C:/Games/Skyrim",
        name: "Skyrim Special Edition",
        store_metadata: null,
      },
    ]);

    await expect(
      loadStoreGames({
        ensureQueryData,
      }),
    ).resolves.toEqual([
      {
        store_type: "steam",
        store_id: "489830",
        install_path: "C:/Games/Skyrim",
        name: "Skyrim Special Edition",
        store_metadata: null,
      },
    ]);

    expect(ensureQueryData).toHaveBeenCalledWith("all_store_games", {}, {
      force: true,
    });
  });
});
