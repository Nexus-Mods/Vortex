import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../fs", () => ({
  statAsync: vi.fn(),
  readFileAsync: vi.fn(),
  readdirAsync: vi.fn(),
}));
vi.mock("../log", () => ({ log: vi.fn() }));
vi.mock("simple-vdf", () => ({ parse: vi.fn() }));

import * as fsModule from "../fs";
import { parse } from "simple-vdf";
import {
  PROTON_USERNAME,
  getMyGamesPath,
  getCompatDataPath,
  getWinePrefixPath,
  isWindowsExecutable,
  buildProtonEnvironment,
  buildProtonCommand,
  detectProtonUsage,
  getProtonInfo,
} from "./proton";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PROTON_USERNAME", () => {
  it('is "steamuser"', () => {
    expect(PROTON_USERNAME).toBe("steamuser");
  });
});

describe("getMyGamesPath", () => {
  it("returns a path containing steamuser and My Games", () => {
    const result = getMyGamesPath("/compat");
    expect(result).toContain("steamuser");
    expect(result).toContain("My Games");
  });

  it("returns the expected full path", () => {
    const result = getMyGamesPath("/compat");
    expect(result).toBe(
      "/compat/pfx/drive_c/users/steamuser/Documents/My Games",
    );
  });
});

describe("getCompatDataPath", () => {
  it("returns steamapps/compatdata/{appId}", () => {
    expect(getCompatDataPath("/steamapps", "123")).toBe(
      "/steamapps/compatdata/123",
    );
  });
});

describe("getWinePrefixPath", () => {
  it("returns compatDataPath/pfx", () => {
    expect(getWinePrefixPath("/compat/data")).toBe("/compat/data/pfx");
  });
});

describe("isWindowsExecutable", () => {
  it("returns true for .exe files", () => {
    expect(isWindowsExecutable("game.exe")).toBe(true);
  });

  it("returns true for .bat files", () => {
    expect(isWindowsExecutable("script.bat")).toBe(true);
  });

  it("returns true for .cmd files", () => {
    expect(isWindowsExecutable("script.cmd")).toBe(true);
  });

  it("returns false for .sh files", () => {
    expect(isWindowsExecutable("game.sh")).toBe(false);
  });

  it("returns false for .ts files", () => {
    expect(isWindowsExecutable("file.ts")).toBe(false);
  });

  it("returns false for files with no extension", () => {
    expect(isWindowsExecutable("file")).toBe(false);
  });

  it("is case-insensitive for extensions", () => {
    expect(isWindowsExecutable("Game.EXE")).toBe(true);
    expect(isWindowsExecutable("Script.BAT")).toBe(true);
  });
});

describe("buildProtonEnvironment", () => {
  it("returns object with all 3 required keys set", () => {
    const result = buildProtonEnvironment("/compat/data", "/steam");
    expect(result).toEqual({
      STEAM_COMPAT_DATA_PATH: "/compat/data",
      STEAM_COMPAT_CLIENT_INSTALL_PATH: "/steam",
      WINEPREFIX: "/compat/data/pfx",
    });
  });

  it("merges existingEnv and overrides with Proton keys", () => {
    const existing = { MY_VAR: "hello", STEAM_COMPAT_DATA_PATH: "old" };
    const result = buildProtonEnvironment("/compat/data", "/steam", existing);
    expect(result.MY_VAR).toBe("hello");
    expect(result.STEAM_COMPAT_DATA_PATH).toBe("/compat/data");
    expect(result.WINEPREFIX).toBe("/compat/data/pfx");
  });
});

describe("buildProtonCommand", () => {
  it("sets executable to protonPath/proton", () => {
    const result = buildProtonCommand("/proton/dir", "/game/game.exe", []);
    expect(result.executable).toBe("/proton/dir/proton");
  });

  it("sets args to [run, exePath, ...extra]", () => {
    const result = buildProtonCommand("/proton/dir", "/game/game.exe", [
      "--fullscreen",
      "--nosplash",
    ]);
    expect(result.args).toEqual([
      "run",
      "/game/game.exe",
      "--fullscreen",
      "--nosplash",
    ]);
  });

  it("handles empty extra args", () => {
    const result = buildProtonCommand("/proton/dir", "/game/game.exe", []);
    expect(result.args).toEqual(["run", "/game/game.exe"]);
  });
});

describe("detectProtonUsage", () => {
  it("returns true when statAsync resolves", async () => {
    vi.mocked(fsModule.statAsync).mockResolvedValue(undefined as any);
    const result = await detectProtonUsage("/steamapps", "456");
    expect(result).toBe(true);
  });

  it("returns false when statAsync rejects", async () => {
    vi.mocked(fsModule.statAsync).mockRejectedValue(new Error("ENOENT"));
    const result = await detectProtonUsage("/steamapps", "456");
    expect(result).toBe(false);
  });

  it("calls statAsync with the expected compatdata path", async () => {
    vi.mocked(fsModule.statAsync).mockResolvedValue(undefined as any);
    await detectProtonUsage("/steamapps", "789");
    expect(fsModule.statAsync).toHaveBeenCalledWith(
      "/steamapps/compatdata/789",
    );
  });
});

describe("getProtonInfo", () => {
  describe("when oslist contains linux", () => {
    it('returns { usesProton: false }', async () => {
      // statAsync resolves — compatdata exists, but oslist wins
      vi.mocked(fsModule.statAsync).mockResolvedValue(undefined as any);
      const result = await getProtonInfo(
        "/steam",
        "/steamapps",
        "100",
        "linux,windows",
      );
      expect(result).toEqual({ usesProton: false });
    });

    it("returns usesProton false even if compatdata exists", async () => {
      vi.mocked(fsModule.statAsync).mockResolvedValue(undefined as any);
      const result = await getProtonInfo(
        "/steam",
        "/steamapps",
        "101",
        "linux",
      );
      expect(result.usesProton).toBe(false);
    });
  });

  describe("when oslist does NOT contain linux", () => {
    beforeEach(() => {
      // detectProtonUsage → stat resolves (compatdata exists)
      vi.mocked(fsModule.statAsync).mockResolvedValue(undefined as any);
      // getConfiguredProtonName → readFileAsync throws so protonName = undefined
      vi.mocked(fsModule.readFileAsync).mockRejectedValue(
        new Error("ENOENT"),
      );
      // findLatestProton → readdirAsync returns a Proton folder
      vi.mocked(fsModule.readdirAsync).mockResolvedValue([
        "Proton 9.0",
      ] as any);
    });

    it("returns usesProton: true", async () => {
      const result = await getProtonInfo(
        "/steam",
        "/steamapps",
        "200",
        "windows",
      );
      expect(result.usesProton).toBe(true);
    });

    it("returns the expected compatDataPath", async () => {
      const result = await getProtonInfo(
        "/steam",
        "/steamapps",
        "200",
        "windows",
      );
      expect(result.compatDataPath).toBe("/steamapps/compatdata/200");
    });

    it("returns a protonPath from the latest Proton scan", async () => {
      const result = await getProtonInfo(
        "/steam",
        "/steamapps",
        "200",
        "windows",
      );
      expect(result.protonPath).toBe("/steam/steamapps/common/Proton 9.0");
    });
  });

  describe("when oslist is absent — falls back to compatdata existence", () => {
    it("returns usesProton: true when compatdata exists", async () => {
      vi.mocked(fsModule.statAsync).mockResolvedValue(undefined as any);
      vi.mocked(fsModule.readFileAsync).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fsModule.readdirAsync).mockResolvedValue([] as any);

      const result = await getProtonInfo("/steam", "/steamapps", "300");
      expect(result.usesProton).toBe(true);
    });

    it("returns usesProton: false when compatdata does not exist", async () => {
      vi.mocked(fsModule.statAsync).mockRejectedValue(new Error("ENOENT"));

      const result = await getProtonInfo("/steam", "/steamapps", "301");
      expect(result.usesProton).toBe(false);
    });
  });

  describe("when a configured Proton name resolves to a path", () => {
    it("uses the resolved path as protonPath", async () => {
      // detectProtonUsage: stat call for compatdata → resolves
      // resolveProtonPath: stat calls for custom tool and exact match → reject (not found)
      // readdirAsync for fuzzy scan → returns matching Proton folder
      let statCallCount = 0;
      vi.mocked(fsModule.statAsync).mockImplementation((p: string) => {
        statCallCount++;
        // First call: compatdata check
        if (statCallCount === 1) return Promise.resolve(undefined as any);
        // Subsequent calls: custom tool / exact match not found
        return Promise.reject(new Error("ENOENT"));
      });

      vi.mocked(fsModule.readFileAsync).mockResolvedValue(
        Buffer.from("") as any,
      );
      vi.mocked(parse).mockReturnValue({
        InstallConfigStore: {
          Software: {
            Valve: {
              Steam: {
                CompatToolMapping: {
                  "400": { name: "proton_experimental" },
                },
              },
            },
          },
        },
      } as any);
      vi.mocked(fsModule.readdirAsync).mockResolvedValue([
        "Proton - Experimental",
        "Proton 9.0",
      ] as any);

      const result = await getProtonInfo(
        "/steam",
        "/steamapps",
        "400",
        "windows",
      );
      expect(result.usesProton).toBe(true);
      expect(result.protonPath).toContain("Experimental");
    });
  });
});
