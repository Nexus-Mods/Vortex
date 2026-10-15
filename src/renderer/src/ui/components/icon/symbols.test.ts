import { describe, it, expect } from "vitest";

import { symbolNames } from "./symbols";

describe("symbolNames", () => {
  it("has no name twice", () => {
    expect(new Set(symbolNames).size).toBe(symbolNames.length);
  });

  it("is in alphabetical order, so that a name is easy to find and to add", () => {
    expect([...symbolNames]).toEqual([...symbolNames].sort());
  });
});
