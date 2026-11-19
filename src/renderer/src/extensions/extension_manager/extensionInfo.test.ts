import { beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "../../logging";
import { parseExtensionInfo } from "./extensionInfo";

vi.mock("../../logging", () => ({ log: vi.fn() }));

describe("parseExtensionInfo", () => {
  const base = { name: "Cyberpunk 2077 Vortex Support", version: "0.13.0" };

  beforeEach(() => {
    vi.mocked(log).mockClear();
  });

  it("reads the mod id written at install", () => {
    expect(parseExtensionInfo({ ...base, modId: 196 }).modId).toBe(196);
  });

  it("leaves an extension without a mod id unlinked", () => {
    expect(parseExtensionInfo(base).modId).toBeUndefined();
  });

  it("ignores an unusable mod id instead of failing to load the extension", () => {
    expect(parseExtensionInfo({ ...base, modId: "196" }).modId).toBeUndefined();
  });

  describe("contributes", () => {
    const valid = {
      games: { cyberpunk2077: { nexusGameId: 3333, name: "Cyberpunk 2077" } },
      gameEnhancements: [{ gameUid: "ABC-123" }],
    };

    it("stays in legacy mode without contributes, without a warning", () => {
      expect(parseExtensionInfo(base).contributes).toBeUndefined();
      expect(log).not.toHaveBeenCalled();
    });

    it("puts a valid contributes on the info, with lowercase uids", () => {
      const info = parseExtensionInfo({ ...base, contributes: valid });
      expect(info.contributes?.games?.["cyberpunk2077" as never]).toMatchObject({
        nexusGameId: 3333,
      });
      expect(info.contributes?.gameEnhancements).toEqual([{ gameUid: "abc-123" }]);
      expect(log).not.toHaveBeenCalled();
    });

    it("falls back to legacy mode with a warning on an invalid contributes", () => {
      const info = parseExtensionInfo({
        ...base,
        id: "cyberpunk-support",
        contributes: { gameEnhancements: [{ gameUid: "abc", nexusGameId: 1 }] },
      });
      expect(info.name).toBe(base.name);
      expect(info.contributes).toBeUndefined();
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith(
        "warn",
        expect.any(String),
        expect.objectContaining({ extension: "cyberpunk-support" }),
      );
    });

    it("treats a non-object contributes as invalid instead of rejecting", () => {
      const info = parseExtensionInfo({ ...base, contributes: null });
      expect(info.contributes).toBeUndefined();
      expect(log).toHaveBeenCalledTimes(1);
    });

    it("accepts unknown keys inside contributes", () => {
      const info = parseExtensionInfo({
        ...base,
        contributes: { ...valid, somethingNew: true },
      });
      expect(info.contributes).toBeDefined();
      expect(info.contributes).not.toHaveProperty("somethingNew");
      expect(log).not.toHaveBeenCalled();
    });
  });
});
