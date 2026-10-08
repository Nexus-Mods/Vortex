import { describe, expect, it } from "vitest";

import { makeLoadOrder, makeLoadOrderEntry, makeMod } from "../../test-utils/builders";
import { holdAwaitsMods, holdCanRestore, holdIsStale } from "./hold";

const held = (...awaitedVortexModIds: string[]) => ({
  loadOrder: makeLoadOrder("x.pak"),
  awaitedVortexModIds,
});

describe("holdCanRestore", () => {
  it("restores once the game lists every awaited mod", () => {
    const fromGame = [
      makeLoadOrderEntry({ id: "a.pak", modId: "mod-a" }),
      makeLoadOrderEntry({ id: "b.pak", modId: "mod-b" }),
    ];

    expect(holdCanRestore(held("mod-a", "mod-b"), fromGame)).toBe(true);
  });

  it("keeps holding while an awaited mod is missing from the game's list", () => {
    const fromGame = [makeLoadOrderEntry({ id: "a.pak", modId: "mod-a" })];

    expect(holdCanRestore(held("mod-a", "mod-b"), fromGame)).toBe(false);
  });

  it("matches an entry keyed by its mod's Vortex id", () => {
    expect(holdCanRestore(held("mod-a"), makeLoadOrder("mod-a"))).toBe(true);
  });

  it("restores a purge hold from any list", () => {
    expect(holdCanRestore(held(), [])).toBe(true);
  });
});

describe("holdAwaitsMods", () => {
  it("is true for a replacement hold", () => {
    expect(holdAwaitsMods(held("mod-a"))).toBe(true);
  });

  it("is false for a purge hold", () => {
    expect(holdAwaitsMods(held())).toBe(false);
  });
});

describe("holdIsStale", () => {
  const mods = { "mod-a": makeMod({ id: "mod-a" }) };

  it("is stale once an awaited mod no longer exists", () => {
    expect(holdIsStale(held("mod-a", "mod-gone"), mods)).toBe(true);
  });

  it("is not stale while every awaited mod exists", () => {
    expect(holdIsStale(held("mod-a"), mods)).toBe(false);
  });

  it("is never stale for a purge hold", () => {
    expect(holdIsStale(held(), {})).toBe(false);
  });
});
