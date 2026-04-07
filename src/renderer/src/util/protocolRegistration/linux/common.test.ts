import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted so the same fn instance is shared between default and named
// exports. Vitest CJS interop routes named destructured imports through the
// default export, so both must point to the same vi.fn().
const mockSpawnSync = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  default: { spawnSync: mockSpawnSync },
  spawnSync: mockSpawnSync,
}));

vi.mock("../../linux/xdg", () => ({
  xdgDataHome: vi.fn(() => "/home/testuser/.local/share"),
}));

vi.mock("../../log", () => ({ log: vi.fn() }));

import {
  applicationsDirectory,
  getDefaultUrlSchemeHandler,
  refreshDesktopDatabase,
} from "./common";

const defaultSpawnResult = {
  status: 0,
  stdout: "",
  stderr: "",
  error: undefined,
  pid: 0,
  output: [],
  signal: null,
};

describe("applicationsDirectory", () => {
  it("returns xdgDataHome joined with applications", () => {
    expect(applicationsDirectory()).toBe(
      "/home/testuser/.local/share/applications",
    );
  });
});

describe("getDefaultUrlSchemeHandler", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSpawnSync.mockReturnValue(defaultSpawnResult);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns trimmed stdout when command succeeds", () => {
    mockSpawnSync.mockReturnValue({
      ...defaultSpawnResult,
      stdout: "com.nexusmods.vortex.desktop\n",
    });

    const result = getDefaultUrlSchemeHandler("nxm");
    expect(result).toBe("com.nexusmods.vortex.desktop");
  });

  it("returns undefined when command exits with non-zero status", () => {
    mockSpawnSync.mockReturnValue({
      ...defaultSpawnResult,
      status: 1,
      stderr: "error",
    });

    const result = getDefaultUrlSchemeHandler("nxm");
    expect(result).toBeUndefined();
  });

  it("returns undefined when spawnSync returns an error object", () => {
    const spawnError = Object.assign(new Error("spawn ENOENT"), {
      code: "ENOENT",
    }) as NodeJS.ErrnoException;
    mockSpawnSync.mockReturnValue({
      ...defaultSpawnResult,
      status: -1,
      error: spawnError,
    });

    const result = getDefaultUrlSchemeHandler("nxm");
    expect(result).toBeUndefined();
  });

  it("calls flatpak-spawn as command when IS_FLATPAK=true", () => {
    vi.stubEnv("IS_FLATPAK", "true");
    mockSpawnSync.mockReturnValue({
      ...defaultSpawnResult,
      stdout: "some.desktop\n",
    });

    getDefaultUrlSchemeHandler("nxm");

    const [command] = mockSpawnSync.mock.calls[0];
    expect(command).toBe("flatpak-spawn");
  });

  it("calls xdg-settings as command when IS_FLATPAK is not set", () => {
    vi.stubEnv("IS_FLATPAK", "false");
    mockSpawnSync.mockReturnValue({
      ...defaultSpawnResult,
      stdout: "some.desktop\n",
    });

    getDefaultUrlSchemeHandler("nxm");

    const [command] = mockSpawnSync.mock.calls[0];
    expect(command).toBe("xdg-settings");
  });

  it("returns undefined when stdout is empty string even with status 0", () => {
    const result = getDefaultUrlSchemeHandler("nxm");
    expect(result).toBeUndefined();
  });
});

describe("refreshDesktopDatabase", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSpawnSync.mockReturnValue(defaultSpawnResult);
  });

  it("calls update-desktop-database with the provided directory", () => {
    refreshDesktopDatabase("/home/testuser/.local/share/applications");

    const calls = mockSpawnSync.mock.calls;
    const updateDbCall = calls.find(([cmd]) => cmd === "update-desktop-database");
    expect(updateDbCall).toBeDefined();
    expect(updateDbCall?.[1]).toContain(
      "/home/testuser/.local/share/applications",
    );
  });
});
