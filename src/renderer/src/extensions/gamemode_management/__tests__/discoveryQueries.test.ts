import {
  loadStoreGames,
  subscribeToStoreGamesDirty,
} from "../util/discoveryQueries";

describe("discoveryQueries", () => {
  it("loads store games from the generic query api", async () => {
    const execute = jest.fn().mockResolvedValue([
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
        execute,
        onDirty: jest.fn(),
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

    expect(execute).toHaveBeenCalledWith("all_store_games", {});
  });

  it("only forwards dirty notifications for the store games query", () => {
    const unsubscribe = jest.fn();
    const callback = jest.fn();
    let listener: ((queryNames: string[]) => void) | undefined;

    const stop = subscribeToStoreGamesDirty(
      {
        execute: jest.fn(),
        onDirty: jest.fn((cb) => {
          listener = cb;
          return unsubscribe;
        }),
      },
      callback,
    );

    listener?.(["recently_managed_games"]);
    expect(callback).not.toHaveBeenCalled();

    listener?.(["all_store_games"]);
    expect(callback).toHaveBeenCalledTimes(1);

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
