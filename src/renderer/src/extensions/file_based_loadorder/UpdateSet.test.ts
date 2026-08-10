import { describe, expect } from "vitest";

import { makeLoadOrderEntry, makeMod } from "../../test-utils/builders";
import { test } from "../../test-utils/fbloTest";
import type { ILoadOrderEntryExt } from "./types/types";

const ext = (overrides: Partial<ILoadOrderEntryExt> = {}): ILoadOrderEntryExt => ({
  ...makeLoadOrderEntry(overrides),
  index: 0,
  ...overrides,
});

describe("UpdateSet.findEntry", () => {
  test("returns null for an entry that was never added", ({ makeFblo }) => {
    const { updateSet, gameId } = makeFblo();
    updateSet.init(gameId, [ext({ id: "a.pak", modId: "mod-a", index: 0 })]);
    expect(updateSet.findEntry(makeLoadOrderEntry({ id: "b.pak", modId: "mod-b" }))).toBeNull();
  });

  test("finds a managed entry by its modId", ({ makeFblo }) => {
    const { updateSet, gameId } = makeFblo();
    updateSet.init(gameId, [ext({ id: "a.pak", modId: "mod-a", index: 0 })]);
    const found = updateSet.findEntry(makeLoadOrderEntry({ id: "a.pak", modId: "mod-a" }));
    expect(found?.entries.map((e) => e.id)).toEqual(["a.pak"]);
  });

  test("finds a managed entry by id when its modId changed", ({ makeFblo }) => {
    const { updateSet, gameId } = makeFblo();
    updateSet.init(gameId, [ext({ id: "a.pak", modId: "mod-old", index: 0 })]);
    // the mod was reinstalled under a new Vortex id but the same pak id
    const found = updateSet.findEntry(makeLoadOrderEntry({ id: "a.pak", modId: "mod-new" }));
    expect(found?.entries.map((e) => e.id)).toEqual(["a.pak"]);
  });

  test("resolves each pak to its own bucket when two share a non-numeric modId", ({ makeFblo }) => {
    // A manually-installed mod (no numeric attributes.modId) shipping two paks: both entries carry
    // the same modId but must resolve to the bucket that actually contains the looked-up id.
    const { updateSet, gameId } = makeFblo();
    updateSet.init(gameId, [
      ext({ id: "a.pak", modId: "manual", index: 0 }),
      ext({ id: "b.pak", modId: "manual", index: 1 }),
    ]);
    const a = updateSet.findEntry(makeLoadOrderEntry({ id: "a.pak", modId: "manual" }));
    const b = updateSet.findEntry(makeLoadOrderEntry({ id: "b.pak", modId: "manual" }));
    expect(a?.entries.some((e) => e.id === "a.pak")).toBe(true);
    expect(b?.entries.some((e) => e.id === "b.pak")).toBe(true);
  });

  test("groups paks of one Nexus mod (numeric modId) into a shared bucket", ({ makeFblo }) => {
    const { updateSet, gameId } = makeFblo({
      mods: { "mod-a": makeMod({ id: "mod-a", attributes: { modId: 42 } }) },
    });
    updateSet.init(gameId, [
      ext({ id: "a.pak", modId: "mod-a", index: 0 }),
      ext({ id: "b.pak", modId: "mod-a", index: 1 }),
    ]);
    const found = updateSet.findEntry(makeLoadOrderEntry({ id: "a.pak", modId: "mod-a" }));
    expect(found?.entries.map((e) => e.id).sort()).toEqual(["a.pak", "b.pak"]);
  });

  test("finds an external entry (no modId) by id", ({ makeFblo }) => {
    const { updateSet, gameId } = makeFblo();
    updateSet.init(gameId, [ext({ id: "ext.pak", modId: undefined, index: 0 })]);
    const found = updateSet.findEntry(makeLoadOrderEntry({ id: "ext.pak" }));
    expect(found?.entries.map((e) => e.id)).toEqual(["ext.pak"]);
  });
});

describe("UpdateSet.restore", () => {
  test("reorders entries by their stored index", ({ makeFblo }) => {
    const { updateSet, gameId } = makeFblo();
    updateSet.init(gameId, [
      ext({ id: "a.pak", name: "A", modId: "mod-a", index: 0 }),
      ext({ id: "b.pak", name: "B", modId: "mod-b", index: 1 }),
      ext({ id: "c.pak", name: "C", modId: "mod-c", index: 2 }),
    ]);
    updateSet.shouldRestore = true;
    // present them out of order; restore should sort back to a, b, c
    const restored = updateSet.restore([
      makeLoadOrderEntry({ id: "c.pak", name: "C", modId: "mod-c" }),
      makeLoadOrderEntry({ id: "a.pak", name: "A", modId: "mod-a" }),
      makeLoadOrderEntry({ id: "b.pak", name: "B", modId: "mod-b" }),
    ]);
    expect(restored.map((e) => e.id)).toEqual(["a.pak", "b.pak", "c.pak"]);
  });
});

describe("UpdateSet.reset", () => {
  test("forceReset clears stored entries", ({ makeFblo }) => {
    const { updateSet, gameId } = makeFblo();
    updateSet.init(gameId, [ext({ id: "a.pak", modId: "mod-a", index: 0 })]);
    updateSet.forceReset();
    expect(updateSet.findEntry(makeLoadOrderEntry({ id: "a.pak", modId: "mod-a" }))).toBeNull();
    expect(updateSet.isInitialized()).toBe(false);
  });
});
