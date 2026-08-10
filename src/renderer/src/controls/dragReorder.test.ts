import { describe, expect, it } from "vitest";

import { moveItems, shouldReorder } from "./dragReorder";

describe("moveItems", () => {
  it("moves a single item down", () => {
    expect(moveItems(["a", "b", "c", "d"], ["a"], 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves a single item up", () => {
    expect(moveItems(["a", "b", "c", "d"], ["c"], 0)).toEqual(["c", "a", "b", "d"]);
  });

  it("moves a multi-selection, preserving its order", () => {
    expect(moveItems(["a", "b", "c", "d", "e"], ["b", "d"], 0)).toEqual(["b", "d", "a", "c", "e"]);
  });

  it("does not mutate the input list", () => {
    const list = ["a", "b", "c"];
    moveItems(list, ["a"], 2);
    expect(list).toEqual(["a", "b", "c"]);
  });

  it("inserts an item not present in the list (cross-container drop)", () => {
    // a multi-select take yields single-element arrays; the first element is used
    expect(moveItems(["a", "b"], [["x"]], 1)).toEqual(["a", "x", "b"]);
  });
});

describe("shouldReorder", () => {
  it("does not swap a row with itself", () => {
    expect(shouldReorder(2, 2, 30, 20)).toBe(false);
  });

  it("swaps downward once the cursor passes the middle", () => {
    expect(shouldReorder(1, 3, 30, 20)).toBe(true);
  });

  it("waits while dragging down above the middle", () => {
    expect(shouldReorder(1, 3, 10, 20)).toBe(false);
  });

  it("swaps upward once the cursor passes the middle", () => {
    expect(shouldReorder(3, 1, 10, 20)).toBe(true);
  });

  it("waits while dragging up below the middle", () => {
    expect(shouldReorder(3, 1, 30, 20)).toBe(false);
  });
});
