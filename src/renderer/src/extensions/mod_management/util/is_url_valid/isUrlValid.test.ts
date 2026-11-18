import { describe, expect, it } from "vitest";

import { isUrlValid } from "./isUrlValid";

describe("isUrlValid", () => {
  it("accepts a full address", () => {
    expect(isUrlValid("https://www.nexusmods.com/skyrim")).toBe(true);
  });

  it("rejects text that isn't a full address", () => {
    expect(isUrlValid("nexusmods.com")).toBe(false);
    expect(isUrlValid("")).toBe(false);
    expect(isUrlValid(undefined)).toBe(false);
  });
});
