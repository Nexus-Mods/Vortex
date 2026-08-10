import { describe, expect, it } from "vitest";

import { makeLoadOrderEntry } from "../../test-utils/builders";
import { diffLoadOrder, type ILoadOrderDiffOptions } from "./loadOrderDiff";

// No mod-backed fileId change unless a test opts in.
const noFileIds: ILoadOrderDiffOptions = {
  currentFileId: () => undefined,
  storedFileId: () => undefined,
};

describe("diffLoadOrder", () => {
  it("reports no change for an identical order", () => {
    const lo = [makeLoadOrderEntry({ id: "a" }), makeLoadOrderEntry({ id: "b" })];
    const diff = diffLoadOrder(lo, lo, noFileIds);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.same).toEqual(["a", "b"]);
    expect(diff.shouldRestore).toBe(false);
  });

  it("detects an added entry", () => {
    const prev = [makeLoadOrderEntry({ id: "a" })];
    const next = [makeLoadOrderEntry({ id: "a" }), makeLoadOrderEntry({ id: "b" })];
    const diff = diffLoadOrder(prev, next, noFileIds);
    expect(diff.added).toEqual(["b"]);
    expect(diff.removed).toEqual([]);
  });

  it("detects a removed entry", () => {
    const prev = [makeLoadOrderEntry({ id: "a" }), makeLoadOrderEntry({ id: "b" })];
    const next = [makeLoadOrderEntry({ id: "a" })];
    const diff = diffLoadOrder(prev, next, noFileIds);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual(["b"]);
  });

  it("excludes reordered entries from same", () => {
    const ids = ["a", "b", "c"];
    const prev = ids.map((id) => makeLoadOrderEntry({ id }));
    // a and b swap; c stays put
    const next = ["b", "a", "c"].map((id) => makeLoadOrderEntry({ id }));
    const diff = diffLoadOrder(prev, next, noFileIds);
    expect(diff.same).toEqual(["c"]);
    expect(diff.same.length).not.toBe(next.length);
  });

  it("excludes an entry whose enabled state changed", () => {
    const prev = [makeLoadOrderEntry({ id: "a", enabled: true })];
    const next = [makeLoadOrderEntry({ id: "a", enabled: false })];
    const diff = diffLoadOrder(prev, next, noFileIds);
    expect(diff.same).toEqual([]);
    expect(diff.shouldRestore).toBe(false);
  });

  it("flags a restore when an in-place entry's backing fileId changed", () => {
    const lo = [makeLoadOrderEntry({ id: "a", modId: "mod-a" })];
    const diff = diffLoadOrder(lo, lo, {
      currentFileId: () => 200,
      storedFileId: () => 100,
    });
    expect(diff.shouldRestore).toBe(true);
    expect(diff.same).toEqual([]);
  });

  it("does not flag a restore when the fileId is unchanged", () => {
    const lo = [makeLoadOrderEntry({ id: "a", modId: "mod-a" })];
    const diff = diffLoadOrder(lo, lo, {
      currentFileId: () => 100,
      storedFileId: () => 100,
    });
    expect(diff.shouldRestore).toBe(false);
    expect(diff.same).toEqual(["a"]);
  });

  it("treats a falsy current fileId as no change", () => {
    const lo = [makeLoadOrderEntry({ id: "a", modId: "mod-a" })];
    const diff = diffLoadOrder(lo, lo, {
      currentFileId: () => 0,
      storedFileId: () => 100,
    });
    expect(diff.shouldRestore).toBe(false);
    expect(diff.same).toEqual(["a"]);
  });
});
