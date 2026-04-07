import * as os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { xdgCacheHome, xdgConfigHome, xdgDataHome, xdgStateHome } from "./xdg";

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
}));

describe("xdg path helpers", () => {
  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue("/home/testuser");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("xdgDataHome", () => {
    it("returns XDG_DATA_HOME when set", () => {
      vi.stubEnv("XDG_DATA_HOME", "/custom/data");
      expect(xdgDataHome()).toBe("/custom/data");
    });

    it("falls back to ~/.local/share when XDG_DATA_HOME is unset", () => {
      vi.stubEnv("XDG_DATA_HOME", "");
      expect(xdgDataHome()).toBe("/home/testuser/.local/share");
    });

    it("falls back to ~/.local/share when XDG_DATA_HOME is deleted", () => {
      delete process.env["XDG_DATA_HOME"];
      expect(xdgDataHome()).toBe("/home/testuser/.local/share");
    });
  });

  describe("xdgConfigHome", () => {
    it("returns XDG_CONFIG_HOME when set", () => {
      vi.stubEnv("XDG_CONFIG_HOME", "/custom/config");
      expect(xdgConfigHome()).toBe("/custom/config");
    });

    it("falls back to ~/.config when XDG_CONFIG_HOME is unset", () => {
      vi.stubEnv("XDG_CONFIG_HOME", "");
      expect(xdgConfigHome()).toBe("/home/testuser/.config");
    });
  });

  describe("xdgCacheHome", () => {
    it("returns XDG_CACHE_HOME when set", () => {
      vi.stubEnv("XDG_CACHE_HOME", "/custom/cache");
      expect(xdgCacheHome()).toBe("/custom/cache");
    });

    it("falls back to ~/.cache when unset", () => {
      vi.stubEnv("XDG_CACHE_HOME", "");
      expect(xdgCacheHome()).toBe("/home/testuser/.cache");
    });
  });

  describe("xdgStateHome", () => {
    it("returns XDG_STATE_HOME when set", () => {
      vi.stubEnv("XDG_STATE_HOME", "/custom/state");
      expect(xdgStateHome()).toBe("/custom/state");
    });

    it("falls back to ~/.local/state when unset", () => {
      vi.stubEnv("XDG_STATE_HOME", "");
      expect(xdgStateHome()).toBe("/home/testuser/.local/state");
    });
  });
});
