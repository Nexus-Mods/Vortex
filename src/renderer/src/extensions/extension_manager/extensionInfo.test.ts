import { describe, expect, it } from "vitest";

import { parseExtensionInfo } from "./extensionInfo";

describe("parseExtensionInfo", () => {
  const base = { name: "Cyberpunk 2077 Vortex Support", version: "0.13.0" };

  it("reads the mod id written at install", () => {
    expect(parseExtensionInfo({ ...base, modId: 196 }).modId).toBe(196);
  });

  it("leaves an extension without a mod id unlinked", () => {
    expect(parseExtensionInfo(base).modId).toBeUndefined();
  });

  it("ignores an unusable mod id instead of failing to load the extension", () => {
    expect(parseExtensionInfo({ ...base, modId: "196" }).modId).toBeUndefined();
  });
});
