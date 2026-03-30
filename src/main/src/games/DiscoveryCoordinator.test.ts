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
});
