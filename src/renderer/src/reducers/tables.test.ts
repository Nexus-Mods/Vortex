import { describe, it, expect } from "vitest";

import { tableReducer } from "./tables";

describe("setAttributeVisible", () => {
  it("marks attribute visible", () => {
    const input = {};
    const result = tableReducer.reducers.SET_ATTRIBUTE_VISIBLE(input, {
      tableId: "test",
      attributeId: "attr1",
      visible: true,
    });
    expect(result).toEqual({
      test: { attributes: { attr1: { enabled: true } } },
    });
  });
  it("marks attribute invisible", () => {
    const input = {};
    const result = tableReducer.reducers.SET_ATTRIBUTE_VISIBLE(input, {
      tableId: "test",
      attributeId: "attr1",
      visible: false,
    });
    expect(result).toEqual({
      test: { attributes: { attr1: { enabled: false } } },
    });
  });
  it("handles persisted table state without attributes", () => {
    const input = { test: { filter: { attr1: "x" } } };
    const result = tableReducer.reducers.SET_ATTRIBUTE_VISIBLE(input, {
      tableId: "test",
      attributeId: "attr1",
      visible: true,
    });
    expect(result).toEqual({
      test: { filter: { attr1: "x" }, attributes: { attr1: { enabled: true } } },
    });
  });
});

describe("setAttributeSort", () => {
  it("set attribute sort direction", () => {
    const input = {};
    const result = tableReducer.reducers.SET_ATTRIBUTE_SORT(input, {
      tableId: "test",
      attributeId: "attr1",
      direction: "asc",
    });
    expect(result).toEqual({
      test: { attributes: { attr1: { sortDirection: "asc" } } },
    });
  });
  it("resets sort direction on other attributes", () => {
    const input = {
      test: { attributes: { attr1: { enabled: true, sortDirection: "asc" as const } } },
    };
    const result = tableReducer.reducers.SET_ATTRIBUTE_SORT(input, {
      tableId: "test",
      attributeId: "attr2",
      direction: "desc",
    });
    expect(result).toEqual({
      test: {
        attributes: {
          attr1: { enabled: true, sortDirection: "none" },
          attr2: { sortDirection: "desc" },
        },
      },
    });
  });
  it("handles persisted table state without attributes", () => {
    const input = { test: { groupBy: "attr2" } };
    const result = tableReducer.reducers.SET_ATTRIBUTE_SORT(input, {
      tableId: "test",
      attributeId: "attr1",
      direction: "asc",
    });
    expect(result).toEqual({
      test: { groupBy: "attr2", attributes: { attr1: { sortDirection: "asc" } } },
    });
  });
});
