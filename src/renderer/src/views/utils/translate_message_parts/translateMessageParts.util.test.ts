import { describe, expect, it, vi } from "vitest";

import { translateMessageParts } from "./translateMessageParts.util";

const shout = (part: string) => part.toUpperCase();

describe("translateMessageParts", () => {
  it("translates a message with no breaks as one part", () => {
    expect(translateMessageParts("one part", shout)).toBe("ONE PART");
  });

  it("translates each tab-separated part, and joins them with a space", () => {
    expect(translateMessageParts("first\tsecond\tthird", shout)).toBe("FIRST SECOND THIRD");
  });

  it("keeps the line breaks, translating each line on its own", () => {
    expect(translateMessageParts("first line\nsecond\tpart\nthird", shout)).toBe(
      "FIRST LINE\nSECOND PART\nTHIRD",
    );
  });

  it("hands each part to translate untouched, so a key is never cut or joined", () => {
    const translate = vi.fn((part: string) => part);

    translateMessageParts("a key\tD:\\path\\file.json\nanother key", translate);

    expect(translate.mock.calls.map(([part]) => part)).toEqual([
      "a key",
      "D:\\path\\file.json",
      "another key",
    ]);
  });

  it("returns an empty message as it is", () => {
    expect(translateMessageParts("", shout)).toBe("");
  });
});
