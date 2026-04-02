import { vi } from "vitest";
import * as path from "node:path";
import { setSafe, deleteOrNop } from "../../../src/renderer/src/util/storeHelper";

// Mock GameStoreHelper — getSteamEntry calls util.GameStoreHelper.getGameStore("steam")
// Tests will override allGames() return values via vi.fn()
export const mockAllGames = vi.fn().mockResolvedValue([]);

const mockGameStoreHelper = {
  getGameStore: vi.fn((storeId: string) => {
    if (storeId === "steam") {
      return { allGames: mockAllGames };
    }
    return undefined;
  }),
};

// Mock getVortexPath
export const mockGetVortexPath = vi.fn((key: string) => {
  if (key === "documents") return "/home/testuser/Documents";
  return "/tmp/vortex";
});

// Mock selectors.discoveryByGame
export const mockDiscoveryByGame = vi.fn().mockReturnValue(undefined);

export const util = {
  setSafe,
  deleteOrNop,
  GameStoreHelper: mockGameStoreHelper,
  getVortexPath: mockGetVortexPath,
  makeOverlayableDictionary: vi.fn((
    dict: Record<string, any>,
    overlays?: Record<string, any>,
    selector?: (gameId: string) => string | undefined,
  ) => {
    const instance = {
      get: (gameId: string, field: string): any => {
        // Apply overlay via selector if available
        const store = selector ? selector(gameId) : undefined;
        if (store && overlays?.[store]?.[gameId]?.[field] !== undefined) {
          return overlays[store][gameId][field];
        }
        return dict[gameId]?.[field];
      },
    };
    return instance;
  }),
};

export const selectors = {
  discoveryByGame: mockDiscoveryByGame,
};

export const types = {};
