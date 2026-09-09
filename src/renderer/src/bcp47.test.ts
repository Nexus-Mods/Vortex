import { describe, expect, it } from "vitest";

import { displayBcp47, isValidBcp47, parseBcp47 } from "./bcp47";

describe("parseBcp47", () => {
  it("canonicalises the language subtag", () => {
    expect(parseBcp47("de")).toBe("de");
    expect(parseBcp47("DE")).toBe("de");
    expect(parseBcp47(" de ")).toBe("de");
  });

  it("canonicalises a language with a region", () => {
    expect(parseBcp47("pt-BR")).toBe("pt-BR");
    expect(parseBcp47("pt-br")).toBe("pt-BR");
    expect(parseBcp47("EN-us")).toBe("en-US");
  });

  it("preserves a script subtag", () => {
    expect(parseBcp47("zh-Hans")).toBe("zh-Hans");
    expect(parseBcp47("zh-Hant-CN")).toBe("zh-Hant-CN");
  });

  it("rejects non-string inputs", () => {
    expect(parseBcp47(undefined)).toBeUndefined();
    expect(parseBcp47(null)).toBeUndefined();
  });

  it("rejects empty or whitespace-only inputs", () => {
    expect(parseBcp47("")).toBeUndefined();
    expect(parseBcp47("   ")).toBeUndefined();
  });

  it("rejects malformed tags", () => {
    expect(parseBcp47("not a tag")).toBeUndefined();
    expect(parseBcp47("123")).toBeUndefined();
    expect(parseBcp47("de-")).toBeUndefined();
    // BCP 47 uses hyphens, not underscores.
    expect(parseBcp47("en_US")).toBeUndefined();
  });
});

describe("isValidBcp47", () => {
  it("accepts well-formed tags the platform recognises", () => {
    expect(isValidBcp47("en")).toBe(true);
    expect(isValidBcp47("en-US")).toBe(true);
    expect(isValidBcp47("zh-Hans")).toBe(true);
    expect(isValidBcp47("zh-Hant-CN")).toBe(true);
    expect(isValidBcp47("pt-BR")).toBe(true);
  });

  it("rejects malformed or empty inputs", () => {
    expect(isValidBcp47("")).toBe(false);
    expect(isValidBcp47("not a tag")).toBe(false);
    expect(isValidBcp47(undefined)).toBe(false);
    expect(isValidBcp47(null)).toBe(false);
  });

  it("rejects well-formed but unknown tags", () => {
    // xx is the BCP 47 private-use range, not a real language.
    expect(isValidBcp47("xx")).toBe(false);
  });
});

describe("displayBcp47", () => {
  it("renders the language in its own script by default", () => {
    expect(displayBcp47("de")).toBe("Deutsch");
  });

  it("renders in the requested locale", () => {
    expect(displayBcp47("de", "en")).toBe("German");
    expect(displayBcp47("de", "fr")).toBe("allemand");
  });

  it("renders script subtags", () => {
    // Intl.DisplayNames renders "Chinese (Simplified)" for zh-Hans in English.
    expect(displayBcp47("zh-Hans", "en")).toContain("Simplified");
  });

  it("falls back to the raw tag for unknown languages", () => {
    expect(displayBcp47("xx")).toBe("xx");
  });
});
