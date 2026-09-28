import { describe, expect, it } from "vitest";

import { maxPriorityFrom } from "./loadOrderPriority";

// Only the fields maxPriorityFrom reads.
const entry = (id: string, pos: number, prefix?: string) =>
  ({ id, pos, data: prefix === undefined ? {} : { prefix } }) as never;

describe("maxPriorityFrom", () => {
  it("reads the prefix from the entry's data", () => {
    // This is the shape deserializeLoadOrder and the load order migration
    // produce, so it's what nearly every entry actually looks like.
    const loadOrder = [entry("a", 0, "42"), entry("b", 1, "7")];
    expect(maxPriorityFrom(loadOrder, 0)).toBe(42);
  });

  it("falls back to the position when an entry has no prefix", () => {
    const loadOrder = [entry("a", 3), entry("b", 1)];
    expect(maxPriorityFrom(loadOrder, 0)).toBe(3);
  });

  it("never returns less than the supplied minimum", () => {
    expect(maxPriorityFrom([entry("a", 1, "2")], 10)).toBe(10);
  });

  it("returns the minimum for an empty load order", () => {
    expect(maxPriorityFrom([], 5)).toBe(5);
  });
});
