import { assert, describe, expect, it } from "vitest";

import type { IExtensionState } from "../types/IState";
import { resolveDependencyExtension, resolveExtension } from "./extensionQueries";

function entry(overrides: Partial<IExtensionState> = {}): IExtensionState {
  return {
    enabled: true,
    version: "1.0.0",
    remove: false,
    endorsed: "Undecided",
    name: "some-ext",
    author: "someone",
    description: "a description",
    path: "/vortex/plugins/some-ext",
    ...overrides,
  };
}

describe("resolveExtension", () => {
  const extState: Record<string, IExtensionState> = {
    shortid_aaa: entry({
      name: "Game X Support",
      infoJsonId: "game-x-support",
      modId: 100,
      path: "/vortex/plugins/game-x-support",
    }),
    shortid_bbb: entry({
      name: "FNV Sanity Check",
      infoJsonId: undefined,
      modId: 200,
      path: "/vortex/plugins/fnv-sanity-check",
    }),
    shortid_ccc: entry({
      name: "theme-dark",
      infoJsonId: "theme-dark",
      modId: undefined,
      path: "/vortex/plugins/theme-dark",
    }),
    shortid_ddd: entry({
      name: "translation-de",
      infoJsonId: undefined,
      modId: undefined,
      path: "/vortex/plugins/translation-de",
    }),
  };

  describe("by modId", () => {
    it("finds the entry matching modId", () => {
      const result = resolveExtension(extState, { modId: 200 });
      assert(result !== undefined);
      expect(result.key).toBe("shortid_bbb");
      expect(result.entry.name).toBe("FNV Sanity Check");
    });

    it("returns undefined for an unknown modId", () => {
      expect(resolveExtension(extState, { modId: 999 })).toBeUndefined();
    });
  });

  describe("by infoJsonId", () => {
    it("finds the entry matching infoJsonId", () => {
      const result = resolveExtension(extState, { infoJsonId: "game-x-support" });
      assert(result !== undefined);
      expect(result.key).toBe("shortid_aaa");
    });

    it("returns undefined for an unknown infoJsonId", () => {
      expect(resolveExtension(extState, { infoJsonId: "nope" })).toBeUndefined();
    });
  });

  describe("by name", () => {
    it("finds the entry matching name", () => {
      const result = resolveExtension(extState, { name: "theme-dark" });
      assert(result !== undefined);
      expect(result.key).toBe("shortid_ccc");
    });

    it("returns undefined for an unknown name", () => {
      expect(resolveExtension(extState, { name: "missing" })).toBeUndefined();
    });
  });

  describe("by path", () => {
    it("finds the entry matching the full path", () => {
      const result = resolveExtension(extState, {
        path: "/vortex/plugins/fnv-sanity-check",
      });
      assert(result !== undefined);
      expect(result.key).toBe("shortid_bbb");
    });

    it("returns undefined for a path that does not exist", () => {
      expect(resolveExtension(extState, { path: "/nowhere" })).toBeUndefined();
    });

    it("does not match a partial path prefix", () => {
      expect(resolveExtension(extState, { path: "/vortex/plugins" })).toBeUndefined();
    });
  });

  describe("by dirname", () => {
    it("finds the entry matching the folder basename", () => {
      const result = resolveExtension(extState, { dirname: "theme-dark" });
      assert(result !== undefined);
      expect(result.key).toBe("shortid_ccc");
    });

    it("returns undefined for an unknown dirname", () => {
      expect(resolveExtension(extState, { dirname: "missing" })).toBeUndefined();
    });
  });

  describe("OR semantics across fields", () => {
    it("matches the first entry whose modId matches", () => {
      const result = resolveExtension(extState, { modId: 200 });
      assert(result !== undefined);
      expect(result.key).toBe("shortid_bbb");
    });

    it("matches the first entry where any field matches (name)", () => {
      const result = resolveExtension(extState, {
        modId: 999,
        name: "Game X Support",
      });
      assert(result !== undefined);
      expect(result.key).toBe("shortid_aaa");
    });

    it("returns the first match in iteration order when multiple entries satisfy different fields", () => {
      const result = resolveExtension(extState, {
        infoJsonId: "game-x-support",
        dirname: "theme-dark",
      });
      assert(result !== undefined);
      expect(result.key).toBe("shortid_aaa");
    });
  });

  describe("edge cases", () => {
    it("returns undefined for an empty extension map", () => {
      expect(resolveExtension({}, { name: "anything" })).toBeUndefined();
    });

    it("returns undefined when all query fields are undefined", () => {
      expect(resolveExtension(extState, { modId: undefined, name: undefined })).toBeUndefined();
    });

    it("returns undefined when the query object is effectively empty", () => {
      expect(resolveExtension(extState, {})).toBeUndefined();
    });

    it("matches the first entry where any field matches (name match precedes modId due to iteration order)", () => {
      const state: Record<string, IExtensionState> = {
        key_a: entry({ name: "value", modId: 1 }),
        key_b: entry({ name: "different", modId: 2 }),
      };
      const result = resolveExtension(state, { modId: 2, name: "value" });
      assert(result !== undefined);
      expect(result.key).toBe("key_a");
    });

    it("matches modId === 0 correctly (falsy but valid)", () => {
      const state: Record<string, IExtensionState> = {
        key_a: entry({ name: "zero-id", modId: 0 }),
      };
      const result = resolveExtension(state, { modId: 0 });
      assert(result !== undefined);
      expect(result.key).toBe("key_a");
    });
  });
});

describe("resolveDependencyExtension", () => {
  const extState: Record<string, IExtensionState> = {
    shortid_aaa: entry({
      name: "Game X Support",
      infoJsonId: "game-x-support",
      modId: 100,
      path: "/vortex/plugins/game-x-support",
    }),
    shortid_bbb: entry({
      name: "FNV Sanity Check",
      infoJsonId: undefined,
      modId: 200,
      path: "/vortex/plugins/fnv-sanity-check",
    }),
    shortid_ccc: entry({
      name: "theme-dark",
      infoJsonId: "theme-dark",
      modId: undefined,
      path: "/vortex/plugins/theme-dark",
    }),
  };

  it("matches by infoJsonId (highest priority)", () => {
    const result = resolveDependencyExtension(extState, "game-x-support");
    assert(result !== undefined);
    expect(result.key).toBe("shortid_aaa");
  });

  it("falls back to name when infoJsonId does not match", () => {
    const result = resolveDependencyExtension(extState, "theme-dark");
    assert(result !== undefined);
    expect(result.key).toBe("shortid_ccc");
  });

  it("falls back to modId (coerced to string) when name does not match", () => {
    const result = resolveDependencyExtension(extState, "200");
    assert(result !== undefined);
    expect(result.key).toBe("shortid_bbb");
  });

  it("returns undefined when nothing matches", () => {
    expect(resolveDependencyExtension(extState, "completely-unknown")).toBeUndefined();
  });

  it("returns undefined for an empty extension map", () => {
    expect(resolveDependencyExtension({}, "anything")).toBeUndefined();
  });

  it("prefers infoJsonId match over name match when both exist on different entries", () => {
    const state: Record<string, IExtensionState> = {
      key_a: entry({ name: "common-name", infoJsonId: "unique-a" }),
      key_b: entry({ name: "unique-a", infoJsonId: undefined }),
    };
    const result = resolveDependencyExtension(state, "unique-a");
    assert(result !== undefined);
    expect(result.key).toBe("key_a");
  });

  it("does not crash when an entry has no modId", () => {
    const state: Record<string, IExtensionState> = {
      key_a: entry({ name: "no-id", modId: undefined }),
    };
    const result = resolveDependencyExtension(state, "no-id");
    assert(result !== undefined);
    expect(result.key).toBe("key_a");
  });
});
