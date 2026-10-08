import { describe, expect, it } from "vitest";

import { makeLoadOrderEntry } from "../../test-utils/builders";
import { diffLoadOrder } from "./loadOrderDiff";

describe("diffLoadOrder", () => {
  it("reports no change for an identical order", () => {
    const lo = [makeLoadOrderEntry({ id: "a" }), makeLoadOrderEntry({ id: "b" })];
    const diff = diffLoadOrder(lo, lo);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.same).toEqual(["a", "b"]);
  });

  it("detects an added entry", () => {
    const prev = [makeLoadOrderEntry({ id: "a" })];
    const next = [makeLoadOrderEntry({ id: "a" }), makeLoadOrderEntry({ id: "b" })];
    const diff = diffLoadOrder(prev, next);
    expect(diff.added).toEqual(["b"]);
    expect(diff.removed).toEqual([]);
  });

  it("detects a removed entry", () => {
    const prev = [makeLoadOrderEntry({ id: "a" }), makeLoadOrderEntry({ id: "b" })];
    const next = [makeLoadOrderEntry({ id: "a" })];
    const diff = diffLoadOrder(prev, next);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual(["b"]);
  });

  it("excludes reordered entries from same", () => {
    const ids = ["a", "b", "c"];
    const prev = ids.map((id) => makeLoadOrderEntry({ id }));
    // a and b swap; c stays put
    const next = ["b", "a", "c"].map((id) => makeLoadOrderEntry({ id }));
    const diff = diffLoadOrder(prev, next);
    expect(diff.same).toEqual(["c"]);
    expect(diff.same.length).not.toBe(next.length);
  });

  it("excludes an entry whose enabled state changed", () => {
    const prev = [makeLoadOrderEntry({ id: "a", enabled: true })];
    const next = [makeLoadOrderEntry({ id: "a", enabled: false })];
    const diff = diffLoadOrder(prev, next);
    expect(diff.same).toEqual([]);
  });
});
