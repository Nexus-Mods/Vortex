import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { VortexGameId } from "@vortex/shared";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { IGame } from "@/types/IGame";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";

import * as storeLookup from "../../../util/storeLookup";
import { quickDiscovery } from "./discovery";
import { identifyStore } from "./identifyStore";

vi.mock("../../../util/storeLookup", () => ({ find: vi.fn() }));

vi.mock("./getGame", () => ({
  getGameStores: () => [],
  getGameStoresSafe: () => [],
}));

vi.mock("./identifyStore", () => ({ identifyStore: vi.fn() }));

vi.mock("../../../util/getNormalizeFunc", () => ({
  default: () => Promise.resolve((input: string) => input),
}));

// discovery stats what it finds, so the installs have to exist
const root = mkdtempSync(path.join(tmpdir(), "vortex-discovery-"));
const installDir = (name: string): string => {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

afterAll(() => rmSync(root, { recursive: true, force: true }));

const entry = (gameStoreId: string, priority: number): IGameStoreEntry =>
  ({ gameStoreId, gamePath: installDir(gameStoreId), priority }) as IGameStoreEntry;

const argsGame = {
  id: "fallout4",
  name: "Fallout 4",
  queryArgs: { steam: [{ name: "Fallout 4" }], gog: [{ id: "1", prefer: 0 }] },
  executable: () => "Fallout4.exe",
} as unknown as IGame;

const pathGame = {
  id: "bladeandsorcery",
  name: "Blade and Sorcery",
  queryPath: () => installDir("blade"),
  executable: () => "BladeAndSorcery.exe",
} as unknown as IGame;

const discover = (game: IGame, preference?: { gameId: string; store: string }) => {
  const onDiscoveredGame = vi.fn();
  const result = quickDiscovery(
    [game],
    {},
    onDiscoveredGame,
    vi.fn(),
    undefined,
    preference && { gameId: VortexGameId(preference.gameId), store: preference.store },
  );

  return { onDiscoveredGame, result };
};

describe("quickDiscovery", () => {
  beforeEach(() => {
    vi.mocked(storeLookup.find).mockReset();
    vi.mocked(identifyStore).mockReset();
  });

  describe("a game found through queryArgs", () => {
    beforeEach(() => {
      // the order a scan sees them in: GOG is the extension's preferred store
      vi.mocked(storeLookup.find).mockResolvedValue([entry("steam", 40), entry("gog", 0)]);
    });

    it("takes the highest priority install when no store was picked", async () => {
      const { onDiscoveredGame, result } = discover(argsGame);

      await expect(result).resolves.toEqual(["fallout4"]);
      expect(onDiscoveredGame).toHaveBeenCalledWith(
        "fallout4",
        expect.objectContaining({ store: "gog" }),
      );
    });

    it("takes the install in the picked store, whatever ranks higher", async () => {
      const { onDiscoveredGame, result } = discover(argsGame, {
        gameId: "fallout4",
        store: "steam",
      });

      await expect(result).resolves.toEqual(["fallout4"]);
      expect(onDiscoveredGame).toHaveBeenCalledWith(
        "fallout4",
        expect.objectContaining({ store: "steam", path: installDir("steam") }),
      );
    });

    it("finds nothing rather than another store's install when the picked one has none", async () => {
      const { onDiscoveredGame, result } = discover(argsGame, {
        gameId: "fallout4",
        store: "epic",
      });

      await expect(result).resolves.toEqual([]);
      expect(onDiscoveredGame).not.toHaveBeenCalled();
    });

    it("only holds the game the store was picked for to it", async () => {
      const { onDiscoveredGame, result } = discover(argsGame, {
        gameId: "skyrimse",
        store: "steam",
      });

      await expect(result).resolves.toEqual(["fallout4"]);
      expect(onDiscoveredGame).toHaveBeenCalledWith(
        "fallout4",
        expect.objectContaining({ store: "gog" }),
      );
    });
  });

  describe("a game found through queryPath", () => {
    it("takes the path as found when no store was picked", async () => {
      vi.mocked(identifyStore).mockResolvedValue("gog");

      const { onDiscoveredGame, result } = discover(pathGame);

      await expect(result).resolves.toEqual(["bladeandsorcery"]);
      expect(onDiscoveredGame).toHaveBeenCalledWith(
        "bladeandsorcery",
        expect.objectContaining({ store: "gog" }),
      );
    });

    it("takes the path when it's in the picked store", async () => {
      vi.mocked(identifyStore).mockResolvedValue("steam");

      const { onDiscoveredGame, result } = discover(pathGame, {
        gameId: "bladeandsorcery",
        store: "steam",
      });

      await expect(result).resolves.toEqual(["bladeandsorcery"]);
      expect(onDiscoveredGame).toHaveBeenCalledWith(
        "bladeandsorcery",
        expect.objectContaining({ store: "steam" }),
      );
    });

    it("rejects a path that's in another store than the picked one", async () => {
      vi.mocked(identifyStore).mockResolvedValue("gog");

      const { onDiscoveredGame, result } = discover(pathGame, {
        gameId: "bladeandsorcery",
        store: "steam",
      });

      await expect(result).resolves.toEqual([]);
      expect(onDiscoveredGame).not.toHaveBeenCalled();
    });

    it("keeps a path no store claims, which can't be told apart from the picked one", async () => {
      vi.mocked(identifyStore).mockResolvedValue(undefined);

      const { result } = discover(pathGame, { gameId: "bladeandsorcery", store: "steam" });

      await expect(result).resolves.toEqual(["bladeandsorcery"]);
    });
  });
});
