import { describe, expect, it } from "vitest";

import { makeLoadOrderEntry } from "../../test-utils/builders";
import { RenderRowsCache } from "./renderRows";

const order = (...ids: string[]) => ids.map((id) => makeLoadOrderEntry({ id }));

describe("RenderRowsCache", () => {
  it("preserves row-object identity across calls with unchanged inputs", () => {
    const cache = new RenderRowsCache();
    const lo = order("a", "b", "c");
    const first = cache.build(lo, undefined, false, "");
    const second = cache.build(lo, undefined, false, "");
    expect(second).toBe(first);
    expect(second[0]).toBe(first[0]);
  });

  it("rebuilds when the load order reference changes", () => {
    const cache = new RenderRowsCache();
    const first = cache.build(order("a", "b"), undefined, false, "");
    const second = cache.build(order("a", "b"), undefined, false, "");
    expect(second).not.toBe(first);
  });

  it("numbers position 1-based over the full order", () => {
    const cache = new RenderRowsCache();
    const rows = cache.build(order("a", "b", "c"), undefined, false, "");
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it("keeps position from the full order when filtering", () => {
    const cache = new RenderRowsCache();
    const lo = [
      makeLoadOrderEntry({ id: "alpha", name: "alpha" }),
      makeLoadOrderEntry({ id: "beta", name: "beta" }),
      makeLoadOrderEntry({ id: "gamma", name: "gamma" }),
    ];
    const rows = cache.build(lo, undefined, false, "gam");
    expect(rows.map((r) => r.loEntry.id)).toEqual(["gamma"]);
    expect(rows[0].position).toBe(3);
  });

  it("reuses the filtered result for the same filter text", () => {
    const cache = new RenderRowsCache();
    const lo = order("a", "b");
    const first = cache.build(lo, undefined, false, "a");
    const second = cache.build(lo, undefined, false, "a");
    expect(second).toBe(first);
  });

  it("counts locked entries over the full order", () => {
    const cache = new RenderRowsCache();
    const lo = [
      makeLoadOrderEntry({ id: "a", locked: true }),
      makeLoadOrderEntry({ id: "b", locked: "always" }),
      makeLoadOrderEntry({ id: "c" }),
    ];
    const rows = cache.build(lo, undefined, false, "");
    expect(rows.every((r) => r.lockedEntriesCount === 2)).toBe(true);
  });

  it("passes the toggleable flag through as displayCheckboxes", () => {
    const cache = new RenderRowsCache();
    const rows = cache.build(order("a"), undefined, true, "");
    expect(rows[0].displayCheckboxes).toBe(true);
  });
});
