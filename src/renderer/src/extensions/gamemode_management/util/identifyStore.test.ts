import Bluebird from "bluebird";
import { describe, expect, it, vi } from "vitest";

import type { IGameStore } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";

import { identifyStore } from "./identifyStore";

vi.mock("@/util/getNormalizeFunc", () => ({
  default: () => Promise.resolve((p: string) => p.toLowerCase()),
}));

const makeStore = (id: string, opts: Partial<IGameStore> = {}): IGameStore => ({
  id,
  allGames: () => Bluebird.resolve([]),
  snapshot: () => ({ entries: [], isInstalled: true }),
  getGameStorePath: () => Bluebird.resolve(undefined),
  launchGame: () => Bluebird.resolve(),
  reloadGames: () => Bluebird.resolve(),
  findByAppId: () => Bluebird.resolve(undefined),
  findByName: () => Bluebird.resolve(undefined),
  ...opts,
});

describe("identifyStore", () => {
  it("returns the id of the first store in order that matches, not the first resolved", async () => {
    const later = vi.fn(() => Bluebird.resolve(true));
    const stores = [
      makeStore("steam", { identifyGame: () => Bluebird.resolve(false) }),
      makeStore("gog", { identifyGame: () => Bluebird.resolve(true) }),
      makeStore("epic", { identifyGame: later }),
    ];

    await expect(identifyStore("C:\\Games\\Foo", stores)).resolves.toBe("gog");
    // short-circuit: stores after the first match are never probed
    expect(later).not.toHaveBeenCalled();
  });

  it("resolves undefined when no store matches", async () => {
    const stores = [
      makeStore("steam", { identifyGame: () => Bluebird.resolve(false) }),
      makeStore("gog", { identifyGame: () => Bluebird.resolve(false) }),
    ];

    await expect(identifyStore("C:\\Games\\Foo", stores)).resolves.toBeUndefined();
  });

  it("uses the allGames path fallback for stores without identifyGame", async () => {
    const stores = [
      makeStore("steam", {
        allGames: () =>
          Bluebird.resolve([
            {
              appid: "123",
              gamePath: "C:\\Games\\Foo",
              gameStoreId: "steam",
              name: "Foo",
            },
          ]),
      }),
      makeStore("epic", {
        allGames: () =>
          Bluebird.resolve([
            {
              appid: "456",
              gamePath: "C:\\Games\\Bar",
              gameStoreId: "epic",
              name: "Bar",
            },
          ]),
      }),
    ];

    await expect(identifyStore("c:\\games\\foo", stores)).resolves.toBe("steam");
    await expect(identifyStore("C:\\GAMES\\BAR", stores)).resolves.toBe("epic");
  });

  it("wires the identifyGame fallback callback to the store's allGames match", async () => {
    let invokedFallback: ((path: string) => PromiseLike<boolean>) | undefined;
    const stores = [
      makeStore("steam", {
        allGames: () =>
          Bluebird.resolve([
            {
              appid: "123",
              gamePath: "C:\\Games\\Foo",
              gameStoreId: "steam",
              name: "Foo",
            },
          ]),
        identifyGame: (_gamePath, fallback) => {
          invokedFallback = fallback;
          return Bluebird.resolve(true);
        },
      }),
    ];

    await expect(identifyStore("C:\\Games\\Foo", stores)).resolves.toBe("steam");
    await expect(invokedFallback?.("c:\\games\\foo")).resolves.toBe(true);
    await expect(invokedFallback?.("C:\\Games\\Other")).resolves.toBe(false);
  });
});
