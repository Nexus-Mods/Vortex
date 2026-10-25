import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  FolderCheckFile,
  FolderCheckInput,
  FolderCheckResult,
  FolderCheckStatus,
} from "@vortex/shared/ipc";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  start: vi.fn(),
  status: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: object) => unknown) => selector({ settings: { interface: {} } }),
}));
vi.mock("../../profile_management/selectors", () => ({ activeGameId: () => "cyberpunk2077" }));
vi.mock("../../gamemode_management/selectors", () => ({
  discoveryByGame: () => ({ path: "D:\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077" }),
}));
vi.mock("../../gamemode_management/util/getGame", () => ({
  getGame: () => ({ details: { steamAppId: 1091500 } }),
  getGameStores: () => [
    {
      id: "steam",
      allGames: () => Promise.resolve([]),
      getGameStorePath: () => Promise.resolve("C:\\Steam\\steam.exe"),
    },
  ],
}));
vi.mock("../utils/resolveCheckInput", () => ({ resolveCheckInput: mocks.resolve }));

import FolderCheckPage from "./FolderCheckPage";

const input: FolderCheckInput = {
  appId: 1091500,
  buildId: 26133166,
  steamPath: "C:\\Steam",
  gamePath: "D:\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077",
  depots: [{ depotId: 1091501, manifestId: "2461377369266892508" }],
};

const file = (relPath: string, extra: Partial<FolderCheckFile> = {}): FolderCheckFile => ({
  relPath,
  size: 1024,
  mtimeMs: 0,
  bucket: "unknown",
  ...extra,
});

const result = (extra: Partial<FolderCheckResult> = {}): FolderCheckResult => ({
  checkedAt: Date.now(),
  input,
  files: [
    file("Cyberpunk2077.exe", { bucket: "game" }),
    file("archive\\pc\\content\\basegame_1.archive", { bucket: "game" }),
    file("red4ext\\config.ini", { bucket: "vortex", changedSinceDeployed: true }),
    file("r6\\logs\\a.log"),
    file("r6\\logs\\b.log"),
    file("debug.log"),
  ],
  missing: [],
  unreadable: [],
  baseFilesWithBackup: 0,
  ...extra,
});

const done = (r: FolderCheckResult): FolderCheckStatus => ({ state: "done", result: r });

describe("FolderCheckPage", () => {
  beforeEach(() => {
    mocks.resolve.mockReset().mockReturnValue({ ok: true, input, discoveryPath: input.gamePath });
    mocks.start.mockReset().mockResolvedValue(undefined);
    mocks.status.mockReset().mockResolvedValue(done(result()));
    Object.assign(window.api, {
      poc: { startFolderCheck: mocks.start, getFolderCheckStatus: mocks.status },
    });
  });

  it("shows the reason when the game can't be checked", async () => {
    mocks.resolve.mockReturnValue({
      ok: false,
      reason: "This check only works for Steam games so far.",
    });
    render(<FolderCheckPage />);
    expect(await screen.findByText("This check only works for Steam games so far.")).toBeTruthy();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("starts a check and renders the summary", async () => {
    render(<FolderCheckPage />);
    expect(await screen.findByText(/^1. Move 3 unknown files/)).toBeTruthy();
    expect(screen.getByText("2. Remove the empty folders left behind")).toBeTruthy();
    expect(screen.getByText(/^3. Restore 0 modified or missing game files/)).toBeTruthy();
    expect(screen.getByText(/plus 1 Vortex files changed since deployed/)).toBeTruthy();
    expect(mocks.start).toHaveBeenCalledWith(input, false);
    expect(mocks.status).toHaveBeenCalledWith(1091500);
  });

  it("warns to purge first when Vortex has linked over game files", async () => {
    mocks.status.mockResolvedValue(done(result({ baseFilesWithBackup: 2 })));
    render(<FolderCheckPage />);
    expect(await screen.findByText(/Purge in Vortex first/)).toBeTruthy();
  });

  it("Re-check forces a new run", async () => {
    render(<FolderCheckPage />);
    await screen.findByText(/Move 3 unknown files/);
    fireEvent.click(screen.getByText("Re-check"));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledWith(input, true));
  });
});
