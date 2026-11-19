import { describe, expect, it } from "vitest";

import { attributeText } from "./attributeText";

describe("attributeText", () => {
  it("keeps a string as it is", () => {
    expect(attributeText("Load after SkyUI")).toBe("Load after SkyUI");
  });

  it("writes a number out", () => {
    expect(attributeText(1704)).toBe("1704");
  });

  it("is none for anything else", () => {
    expect(attributeText(undefined)).toBeUndefined();
    expect(attributeText(["a"])).toBeUndefined();
    expect(attributeText({ text: "a" })).toBeUndefined();
  });
});
