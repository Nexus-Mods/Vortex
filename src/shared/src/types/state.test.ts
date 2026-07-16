import { describe, expect, it } from "vitest";

import { isClobberedKeySegment } from "./state";

describe("isClobberedKeySegment", () => {
  it("accepts normal key segments", () => {
    for (const s of ["persistent", "downloads", "Y-To2XJTA", "skyrimse", "a1b2-c3", "size", ""]) {
      expect(isClobberedKeySegment(s)).toBe(false);
    }
  });

  it("flags U+FFFD (replacement char from an invalid-UTF-8 decode)", () => {
    expect(isClobberedKeySegment("Y-T��TA")).toBe(true);
    expect(isClobberedKeySegment("�")).toBe(true);
  });

  it("flags C0 control chars (< U+0020)", () => {
    expect(isClobberedKeySegment("bad\x01mod")).toBe(true);
    expect(isClobberedKeySegment("\x1ffoo")).toBe(true);
    expect(isClobberedKeySegment("tab\there")).toBe(true); // \t is 0x09
  });

  it("does not flag ordinary punctuation, spaces, or valid multi-byte text", () => {
    expect(isClobberedKeySegment("a b.c_d-e (f)")).toBe(false);
    expect(isClobberedKeySegment("café")).toBe(false);
  });
});
