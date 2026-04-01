import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mygamesPath, iniPath, initGameSupport } from "./gameSupport";
import { mockAllGames, mockDiscoveryByGame } from "../../__mocks__/vortex-api";

let originalPlatform: PropertyDescriptor | undefined;

function setPlatform(platform: string) {
  Object.defineProperty(process, "platform", {
    value: platform,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  // Save original platform descriptor
  originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");

  // Reset all mocks
  vi.clearAllMocks();
  mockAllGames.mockResolvedValue([]);
  mockDiscoveryByGame.mockReturnValue(undefined);

  // Initialize gameSupport with a mock API
  const mockApi = {
    store: {
      getState: () => ({}),
    },
  } as any;
  initGameSupport(mockApi);
});

afterEach(() => {
  // Restore original platform
  if (originalPlatform !== undefined) {
    Object.defineProperty(process, "platform", originalPlatform);
  }
});

describe("mygamesPath", () => {
  it("Test 1: returns Wine prefix path when usesProton + compatDataPath on Linux (SAVE-02, SAVE-03)", async () => {
    setPlatform("linux");

    mockDiscoveryByGame.mockReturnValue({
      store: "steam",
      path: "/steam/steamapps/common/Skyrim Special Edition",
    });

    mockAllGames.mockResolvedValue([
      {
        gamePath: "/steam/steamapps/common/Skyrim Special Edition",
        usesProton: true,
        compatDataPath: "/steam/steamapps/compatdata/489830",
      },
    ]);

    const result = await mygamesPath("skyrimse");

    expect(result).toBe(
      "/steam/steamapps/compatdata/489830/pfx/drive_c/users/steamuser/Documents/My Games/Skyrim Special Edition",
    );
  });

  it("Test 2: returns documents fallback on non-Proton Linux (SAVE-02 fallback)", async () => {
    setPlatform("linux");

    mockDiscoveryByGame.mockReturnValue({
      store: "gog",
      path: "/some/gog/path",
    });

    const result = await mygamesPath("skyrimse");

    expect(result).toContain("/home/testuser/Documents/My Games/");
    expect(result).toContain("Skyrim Special Edition");
  });

  it("Test 2b: returns documents fallback on Windows (SAVE-02 fallback)", async () => {
    setPlatform("win32");

    mockDiscoveryByGame.mockReturnValue({
      store: "steam",
      path: "/steam/steamapps/common/Skyrim Special Edition",
    });

    mockAllGames.mockResolvedValue([
      {
        gamePath: "/steam/steamapps/common/Skyrim Special Edition",
        usesProton: true,
        compatDataPath: "/steam/steamapps/compatdata/489830",
      },
    ]);

    const result = await mygamesPath("skyrimse");

    expect(result).toContain("/home/testuser/Documents/My Games/");
    expect(result).toContain("Skyrim Special Edition");
  });

  it("Test 4: getSteamEntry returns undefined on non-Linux — allGames NOT called (guard check)", async () => {
    setPlatform("win32");

    mockDiscoveryByGame.mockReturnValue({
      store: "steam",
      path: "/steam/steamapps/common/Skyrim Special Edition",
    });

    const result = await mygamesPath("skyrimse");

    expect(mockAllGames).not.toHaveBeenCalled();
    expect(result).toContain("/home/testuser/Documents/My Games/");
  });
});

describe("iniPath", () => {
  it("Test 3: returns Linux-aware path including Wine prefix (SAVE-04)", async () => {
    setPlatform("linux");

    mockDiscoveryByGame.mockReturnValue({
      store: "steam",
      path: "/steam/steamapps/common/Skyrim Special Edition",
    });

    mockAllGames.mockResolvedValue([
      {
        gamePath: "/steam/steamapps/common/Skyrim Special Edition",
        usesProton: true,
        compatDataPath: "/steam/steamapps/compatdata/489830",
      },
    ]);

    const result = await iniPath("skyrimse");

    expect(result).toBe(
      "/steam/steamapps/compatdata/489830/pfx/drive_c/users/steamuser/Documents/My Games/Skyrim Special Edition/Skyrim.ini",
    );
  });
});
