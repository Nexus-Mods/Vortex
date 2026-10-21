import { stat } from "node:fs/promises";

import exeVersion from "exe-version";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IGame } from "../../../types/IGame";
import type { IDiscoveryResult } from "../types/IDiscoveryResult";
import { readGameVersions, resolveGameVersion } from "./getGameVersion";

vi.mock("node:fs/promises", () => {
  const stat = vi.fn();
  return { stat, default: { stat } };
});
vi.mock("exe-version", () => ({ default: vi.fn() }));

const discovery = { path: "C:\\Games\\Skyrim" } as IDiscoveryResult;

const makeGame = (getGameVersion?: IGame["getGameVersion"]): IGame =>
  ({
    id: "skyrimse",
    executable: () => "SkyrimSE.exe",
    getGameVersion,
  }) as unknown as IGame;

describe("game version sources", () => {
  beforeEach(() => {
    vi.mocked(stat).mockResolvedValue({} as never);
    vi.mocked(exeVersion).mockReturnValue("1.6.1170.0");
  });

  it("reads both sources separately", async () => {
    const game = makeGame(() => Promise.resolve("1.6.1170"));

    await expect(readGameVersions(game, discovery)).resolves.toEqual({
      exe: "1.6.1170.0",
      extension: "1.6.1170",
    });
    // the merged resolver still prefers the extension
    await expect(resolveGameVersion(game, discovery)).resolves.toBe("1.6.1170");
  });

  it("reports a missing or failing source as null", async () => {
    vi.mocked(stat).mockRejectedValue(new Error("ENOENT"));

    await expect(readGameVersions(makeGame(), discovery)).resolves.toEqual({
      exe: null,
      extension: null,
    });
    await expect(
      readGameVersions(
        makeGame(() => Promise.reject(new Error("broken"))),
        discovery,
      ),
    ).resolves.toEqual({ exe: null, extension: null });
    // the merged resolver keeps its 0.0.0 fallback
    await expect(resolveGameVersion(makeGame(), discovery)).resolves.toBe("0.0.0");
  });

  it("rejects undiscovered games", async () => {
    await expect(
      readGameVersions(makeGame(), { path: undefined } as unknown as IDiscoveryResult),
    ).rejects.toThrow("Game is not discovered");
  });

  it("prefers the game's own getInstalledVersion over the stock sources", async () => {
    // a Tier 0 game: no executable to read, discovery would be rejected
    const game = {
      id: "somegame",
      executable: () => "",
      getInstalledVersion: () => Promise.resolve("unknown"),
    } as unknown as IGame;

    await expect(resolveGameVersion(game, discovery)).resolves.toBe("unknown");
    await expect(
      resolveGameVersion(game, { path: undefined } as unknown as IDiscoveryResult),
    ).resolves.toBe("unknown");
  });
});
