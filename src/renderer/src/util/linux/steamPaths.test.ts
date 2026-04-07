import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs", () => ({
  default: { realpathSync: vi.fn(), statSync: vi.fn() },
  realpathSync: vi.fn(),
  statSync: vi.fn(),
}));
vi.mock("../getVortexPath", () => ({
  default: vi.fn(() => "/home/testuser"),
}));
vi.mock("./xdg", () => ({
  xdgDataHome: vi.fn(() => "/home/testuser/.local/share"),
}));

import * as nodeFs from "fs";
import getVortexPath from "../getVortexPath";
import { xdgDataHome } from "./xdg";
import {
  findAllLinuxSteamPaths,
  findLinuxSteamPath,
  getLinuxSteamPaths,
  isValidSteamPath,
} from "./steamPaths";

const throwEnoent = () => {
  throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
};

beforeEach(() => {
  vi.resetAllMocks();
  // Safe defaults: symlink absent, no valid Steam paths
  vi.mocked(nodeFs.realpathSync).mockImplementation(throwEnoent);
  vi.mocked(nodeFs.statSync).mockImplementation(throwEnoent);
  vi.mocked(getVortexPath).mockReturnValue("/home/testuser");
  vi.mocked(xdgDataHome).mockReturnValue("/home/testuser/.local/share");
});

describe("getLinuxSteamPaths", () => {
  it("includes XDG-derived path when realpathSync throws", () => {
    const paths = getLinuxSteamPaths();
    expect(paths).toContain("/home/testuser/.local/share/Steam");
  });

  it("includes other hardcoded paths when realpathSync throws", () => {
    const paths = getLinuxSteamPaths();
    expect(paths).toContain(
      path.join("/home/testuser", ".steam", "debian-installation"),
    );
    expect(paths).toContain(
      path.join(
        "/home/testuser",
        ".var",
        "app",
        "com.valvesoftware.Steam",
        "data",
        "Steam",
      ),
    );
    expect(paths).toContain(
      path.join("/home/testuser", "snap", "steam", "common", ".local", "share", "Steam"),
    );
    expect(paths).toContain(
      path.join("/home/testuser", ".steam", "steam"),
    );
  });

  it("places the resolved symlink path first in the array", () => {
    const resolved = "/opt/steam";
    vi.mocked(nodeFs.realpathSync).mockReturnValue(resolved);
    const paths = getLinuxSteamPaths();
    expect(paths[0]).toBe(resolved);
  });

  it("deduplicates when realpathSync resolves to a hardcoded path", () => {
    const xdgSteam = "/home/testuser/.local/share/Steam";
    vi.mocked(nodeFs.realpathSync).mockReturnValue(xdgSteam);
    const paths = getLinuxSteamPaths();
    const count = paths.filter((p) => p === xdgSteam).length;
    expect(count).toBe(1);
  });
});

describe("isValidSteamPath", () => {
  it("returns true when statSync does not throw", () => {
    vi.mocked(nodeFs.statSync).mockReturnValue({} as any);
    expect(isValidSteamPath("/some/steam/path")).toBe(true);
  });

  it("calls statSync on the libraryfolders.vdf file", () => {
    vi.mocked(nodeFs.statSync).mockReturnValue({} as any);
    isValidSteamPath("/some/steam/path");
    expect(nodeFs.statSync).toHaveBeenCalledWith(
      path.join("/some/steam/path", "config", "libraryfolders.vdf"),
    );
  });

  it("returns false when statSync throws ENOENT", () => {
    vi.mocked(nodeFs.statSync).mockImplementation(throwEnoent);
    expect(isValidSteamPath("/nonexistent/path")).toBe(false);
  });
});

describe("findLinuxSteamPath", () => {
  it("returns undefined when no path is valid", () => {
    vi.mocked(nodeFs.statSync).mockImplementation(throwEnoent);
    expect(findLinuxSteamPath()).toBeUndefined();
  });

  it("returns the first valid path", () => {
    const xdgSteam = "/home/testuser/.local/share/Steam";
    vi.mocked(nodeFs.statSync).mockImplementation((filePath: any) => {
      if (String(filePath).startsWith(xdgSteam)) {
        return {} as any;
      }
      throwEnoent();
    });
    const result = findLinuxSteamPath();
    expect(result).toBe(xdgSteam);
  });
});

describe("findAllLinuxSteamPaths", () => {
  it("returns all valid paths", () => {
    const validPaths = new Set([
      "/home/testuser/.local/share/Steam",
      path.join("/home/testuser", ".steam", "steam"),
    ]);
    vi.mocked(nodeFs.statSync).mockImplementation((filePath: any) => {
      const dir = path.dirname(path.dirname(String(filePath)));
      if (validPaths.has(dir)) {
        return {} as any;
      }
      throwEnoent();
    });
    const result = findAllLinuxSteamPaths();
    for (const p of validPaths) {
      expect(result).toContain(p);
    }
    expect(result).toHaveLength(validPaths.size);
  });

  it("returns an empty array when no paths are valid", () => {
    vi.mocked(nodeFs.statSync).mockImplementation(throwEnoent);
    expect(findAllLinuxSteamPaths()).toEqual([]);
  });
});
