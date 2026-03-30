import { describe, expect, it, vi } from "vitest";

import { DiscoveryCoordinator } from "./DiscoveryCoordinator";
import type { IStoreGameEntry, IStoreScanner } from "./IStoreScanner";

describe("DiscoveryCoordinator", () => {
  it("runs a second scan immediately after a completed scan", async () => {
    const scanner: IStoreScanner = {
      storeType: "steam",
      isAvailable: vi.fn().mockResolvedValue(true),
      scan: vi.fn().mockResolvedValue([
        {
          storeId: "489830",
          installPath: "C:/Games/Skyrim Special Edition",
          name: "Skyrim Special Edition",
        },
      ]),
    };
    const connection = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    const invalidator = {
      notifyDirtyTables: vi.fn(),
    };

    const coordinator = new DiscoveryCoordinator(
      [scanner],
      connection as any,
      invalidator as any,
    );

    await coordinator.runDiscovery();
    await coordinator.runDiscovery();

    expect(scanner.scan).toHaveBeenCalledTimes(2);
  });

  it("ignores overlapping scan requests while a scan is active", async () => {
    let resolveScan: (() => void) | undefined;
    const scanner: IStoreScanner = {
      storeType: "steam",
      isAvailable: vi.fn().mockResolvedValue(true),
      scan: vi.fn(
        () =>
          new Promise<IStoreGameEntry[]>((resolve) => {
            resolveScan = () =>
              resolve([
                {
                  storeId: "489830",
                  installPath: "C:/Games/Skyrim Special Edition",
                },
              ]);
          }),
      ),
    };
    const connection = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    const invalidator = {
      notifyDirtyTables: vi.fn(),
    };

    const coordinator = new DiscoveryCoordinator(
      [scanner],
      connection as any,
      invalidator as any,
    );

    const firstRun = coordinator.runDiscovery();
    await Promise.resolve();

    await coordinator.runDiscovery();
    expect(scanner.scan).toHaveBeenCalledTimes(1);

    resolveScan?.();
    await firstRun;
  });

  it("invalidates store_games after a successful scan", async () => {
    const scanner: IStoreScanner = {
      storeType: "steam",
      isAvailable: vi.fn().mockResolvedValue(true),
      scan: vi.fn().mockResolvedValue([
        {
          storeId: "489830",
          installPath: "C:/Games/Skyrim Special Edition",
        },
      ]),
    };
    const connection = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    const invalidator = {
      notifyDirtyTables: vi.fn(),
    };

    const coordinator = new DiscoveryCoordinator(
      [scanner],
      connection as any,
      invalidator as any,
    );

    await coordinator.runDiscovery();

    expect(invalidator.notifyDirtyTables).toHaveBeenCalledWith([
      { database: "memory", table: "store_games", type: "UPDATE" },
    ]);
  });

  it("binds SQL values instead of concatenating them into write statements", async () => {
    const scanner: IStoreScanner = {
      storeType: "steam",
      isAvailable: vi.fn().mockResolvedValue(true),
      scan: vi.fn().mockResolvedValue([
        {
          storeId: "app'489830",
          installPath: "C:/Games/Skyrim Special Edition",
          name: "Skyrim Special Edition",
          metadata: {
            publisher: "O'Brien",
          },
        },
      ]),
    };
    const connection = {
      run: vi.fn().mockResolvedValue(undefined),
    };
    const invalidator = {
      notifyDirtyTables: vi.fn(),
    };

    const coordinator = new DiscoveryCoordinator(
      [scanner],
      connection as any,
      invalidator as any,
    );

    await coordinator.runDiscovery();

    expect(connection.run).toHaveBeenNthCalledWith(
      1,
      "DELETE FROM store_games WHERE store_type = ?",
      ["steam"],
    );
    expect(connection.run).toHaveBeenNthCalledWith(
      2,
      `INSERT INTO store_games (store_type, store_id, install_path, name, store_metadata)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (store_type, store_id) DO UPDATE SET
           install_path = EXCLUDED.install_path,
           name = EXCLUDED.name,
           store_metadata = EXCLUDED.store_metadata`,
      [
        "steam",
        "app'489830",
        "C:/Games/Skyrim Special Edition",
        "Skyrim Special Edition",
        JSON.stringify({ publisher: "O'Brien" }),
      ],
    );
  });
});
