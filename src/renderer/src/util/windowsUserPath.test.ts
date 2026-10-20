import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { windowsUserPath } from "./windowsUserPath";

vi.mock("./getVortexPath", () => ({
  default: (id: string) => `/native/${id}`,
}));

vi.mock("../extensions/gamemode_management/util/getGame", () => ({
  getGame: (gameId: string) =>
    gameId === "skyrimse" ? { id: gameId, details: { steamAppId: 489830 } } : { id: gameId },
}));

describe("windowsUserPath", () => {
  let library: string;
  let gamePath: string;
  let userPath: string;

  beforeAll(() => {
    library = fs.mkdtempSync(path.join(os.tmpdir(), "windows-user-path-"));
    gamePath = path.join(library, "steamapps", "common", "Skyrim Special Edition");
    userPath = path.join(
      library,
      "steamapps",
      "compatdata",
      "489830",
      "pfx",
      "drive_c",
      "users",
      "steamuser",
    );
    fs.mkdirSync(gamePath, { recursive: true });
    fs.mkdirSync(userPath, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(library, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const steamDiscovery = (appId = "489830") => ({
    path: gamePath,
    store: "steam",
    environment: { SteamAPPId: appId },
  });

  it("resolves into the game's Proton prefix", () => {
    vi.stubGlobal("process", { ...process, platform: "linux" });
    expect(windowsUserPath("documents", "other", steamDiscovery())).toBe(
      path.join(userPath, "Documents"),
    );
    expect(windowsUserPath("localAppData", "other", steamDiscovery())).toBe(
      path.join(userPath, "AppData", "Local"),
    );
  });

  it("takes the app id from the game when discovery didn't record one", () => {
    vi.stubGlobal("process", { ...process, platform: "linux" });
    expect(windowsUserPath("documents", "skyrimse", { path: gamePath, store: "steam" })).toBe(
      path.join(userPath, "Documents"),
    );
  });

  it("uses the native folder when the game has no prefix", () => {
    vi.stubGlobal("process", { ...process, platform: "linux" });
    expect(windowsUserPath("documents", "other", steamDiscovery("1"))).toBe("/native/documents");
  });

  it("uses the native folder when the game isn't a Steam game", () => {
    vi.stubGlobal("process", { ...process, platform: "linux" });
    expect(windowsUserPath("documents", "other", { path: gamePath, store: "gog" })).toBe(
      "/native/documents",
    );
  });

  it("uses the native folder on Windows", () => {
    vi.stubGlobal("process", { ...process, platform: "win32" });
    expect(windowsUserPath("documents", "skyrimse", steamDiscovery())).toBe("/native/documents");
  });
});
