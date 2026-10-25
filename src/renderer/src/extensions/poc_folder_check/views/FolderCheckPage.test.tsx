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
  gameId: "cyberpunk2077",
}));

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: object) => unknown) => selector({ settings: { interface: {} } }),
}));
vi.mock("../../profile_management/selectors", () => ({ activeGameId: () => mocks.gameId }));
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
  durationMs: 400,
  input,
  mode: "quick",
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
    mocks.gameId = "cyberpunk2077";
    Object.assign(window.api, {
      poc: { startFolderCheck: mocks.start, getFolderCheckStatus: mocks.status },
    });
  });

  it("doesn't start a check while the page is hidden", async () => {
    render(<FolderCheckPage active={false} />);
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("clears the previous game's result when the game changes", async () => {
    const { rerender } = render(<FolderCheckPage active />);
    await screen.findByText(/Move 3 unknown files/);
    mocks.gameId = "witcher3";
    mocks.resolve.mockReturnValue({
      ok: false,
      reason: "This check only works for Steam games so far.",
    });
    rerender(<FolderCheckPage active />);
    expect(await screen.findByText("This check only works for Steam games so far.")).toBeTruthy();
    expect(screen.queryByText(/Move 3 unknown files/)).toBeNull();
  });

  it("sizes the bar by bytes, not file count", async () => {
    mocks.status.mockResolvedValue(
      done(
        result({
          files: [
            file("Data\\Skyrim - Textures1.bsa", { bucket: "game", size: 9000 }),
            file("a.dll", { bucket: "vortex", size: 10 }),
            file("b.dll", { bucket: "vortex", size: 10 }),
            file("c.dll", { bucket: "vortex", size: 10 }),
          ],
        }),
      ),
    );
    render(<FolderCheckPage active />);
    const game = await screen.findByTestId("folder-bar-game");
    expect(game.style.flexGrow).toBe("9000");
    expect(screen.getByTestId("folder-bar-vortex").style.flexGrow).toBe("30");
  });

  it("lists modified, missing and changed files", async () => {
    mocks.status.mockResolvedValue(
      done(
        result({
          files: [
            file("Cyberpunk2077.exe", { bucket: "game", modified: true }),
            file("red4ext\\config.ini", { bucket: "vortex", changedSinceDeployed: true }),
          ],
          missing: [{ relPath: "archive\\pc\\content\\basegame_2.archive", size: 2048 }],
        }),
      ),
    );
    render(<FolderCheckPage active />);
    fireEvent.click(await screen.findByText(/Modified game files/));
    expect(screen.getByText("Cyberpunk2077.exe")).toBeTruthy();
    fireEvent.click(screen.getByText(/Missing game files/));
    expect(screen.getByText("archive\\pc\\content\\basegame_2.archive")).toBeTruthy();
    fireEvent.click(screen.getByText("Changed since deployed"));
    expect(screen.getByText("red4ext\\config.ini")).toBeTruthy();
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
    expect(mocks.start).toHaveBeenCalledWith(input, false, "quick");
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
    await waitFor(() => expect(mocks.start).toHaveBeenCalledWith(input, true, "quick"));
  });

  it("shows how long the check took", async () => {
    mocks.status.mockResolvedValueOnce(done(result({ durationMs: 400 })));
    const { unmount } = render(<FolderCheckPage />);
    expect(await screen.findByText(/quick check .* in 0\.4 s/)).toBeTruthy();
    unmount();

    mocks.status.mockResolvedValueOnce(done(result({ durationMs: 39_584 })));
    render(<FolderCheckPage />);
    expect(await screen.findByText(/in 40 s/)).toBeTruthy();
  });

  it("Full check hashes every file and says so", async () => {
    render(<FolderCheckPage />);
    await screen.findByText(/Move 3 unknown files/);
    expect(screen.getByText(/quick check/)).toBeTruthy();
    mocks.status.mockResolvedValue(done(result({ mode: "full" })));
    fireEvent.click(screen.getByText("Full check"));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledWith(input, true, "full"));
    expect(await screen.findByText(/full check/)).toBeTruthy();
  });
});
