import { describe, expect, it } from "vitest";

import {
  calculateCollectionSize,
  getUnfulfilledNotificationId,
  hasEditPermissions,
  isEmpty,
  isRelevant,
  md5sum,
  ruleId,
} from "./util";

// ---------------------------------------------------------------------------
// hasEditPermissions
// ---------------------------------------------------------------------------

describe("hasEditPermissions", () => {
  it("returns false for undefined permissions", () => {
    expect(hasEditPermissions(undefined as any)).toBe(false);
  });

  it("returns false for null permissions", () => {
    expect(hasEditPermissions(null as any)).toBe(false);
  });

  it("returns false when collection:edit is not present", () => {
    const perms = [{ key: "collection:view" }, { key: "collection:delete" }];
    expect(hasEditPermissions(perms as any)).toBe(false);
  });

  it("returns true when collection:edit is present", () => {
    const perms = [{ key: "collection:view" }, { key: "collection:edit" }];
    expect(hasEditPermissions(perms as any)).toBe(true);
  });

  it("returns false for empty array", () => {
    expect(hasEditPermissions([] as any)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// md5sum
// ---------------------------------------------------------------------------

describe("md5sum", () => {
  it("returns a hex string", () => {
    const result = md5sum("hello");
    expect(result).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is deterministic", () => {
    expect(md5sum("test")).toBe(md5sum("test"));
  });

  it("produces different hashes for different inputs", () => {
    expect(md5sum("a")).not.toBe(md5sum("b"));
  });
});

// ---------------------------------------------------------------------------
// ruleId
// ---------------------------------------------------------------------------

describe("ruleId", () => {
  it("produces a stable md5 hash from source, type, and reference", () => {
    const rule = {
      sourceName: "ModA",
      type: "after",
      referenceName: "ModB",
    } as any;
    const id = ruleId(rule);

    expect(id).toMatch(/^[0-9a-f]{32}$/);
    // Should be deterministic
    expect(ruleId(rule)).toBe(id);
  });

  it("produces different IDs for different rules", () => {
    const rule1 = {
      sourceName: "ModA",
      type: "after",
      referenceName: "ModB",
    } as any;
    const rule2 = {
      sourceName: "ModA",
      type: "before",
      referenceName: "ModB",
    } as any;

    expect(ruleId(rule1)).not.toBe(ruleId(rule2));
  });

  it("produces different IDs when source/reference swap", () => {
    const rule1 = {
      sourceName: "ModA",
      type: "after",
      referenceName: "ModB",
    } as any;
    const rule2 = {
      sourceName: "ModB",
      type: "after",
      referenceName: "ModA",
    } as any;

    expect(ruleId(rule1)).not.toBe(ruleId(rule2));
  });
});

// ---------------------------------------------------------------------------
// getUnfulfilledNotificationId
// ---------------------------------------------------------------------------

describe("getUnfulfilledNotificationId", () => {
  it("returns a prefixed string", () => {
    expect(getUnfulfilledNotificationId("col123")).toBe(
      "collection-incomplete-col123",
    );
  });
});

// ---------------------------------------------------------------------------
// isRelevant
// ---------------------------------------------------------------------------

describe("isRelevant", () => {
  it("returns true when mod has a state (is being downloaded/installed)", () => {
    const mod = { state: "downloading", collectionRule: { type: "recommends" } };
    expect(isRelevant(mod as any)).toBe(true);
  });

  it("returns false when rule is ignored", () => {
    const mod = {
      collectionRule: { type: "requires", ignored: true },
    };
    expect(isRelevant(mod as any)).toBe(false);
  });

  it("returns false for non-requires rules without state", () => {
    const mod = {
      collectionRule: { type: "recommends" },
    };
    expect(isRelevant(mod as any)).toBe(false);
  });

  it("returns true for requires rules without state and not ignored", () => {
    const mod = {
      collectionRule: { type: "requires" },
    };
    expect(isRelevant(mod as any)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateCollectionSize
// ---------------------------------------------------------------------------

describe("calculateCollectionSize", () => {
  it("sums fileSize of relevant mods", () => {
    const mods = {
      m1: {
        attributes: { fileSize: 100 },
        collectionRule: { type: "requires" },
      },
      m2: {
        attributes: { fileSize: 200 },
        collectionRule: { type: "requires" },
      },
    } as any;

    expect(calculateCollectionSize(mods)).toBe(300);
  });

  it("skips irrelevant mods (recommends without state)", () => {
    const mods = {
      m1: {
        attributes: { fileSize: 100 },
        collectionRule: { type: "requires" },
      },
      m2: {
        attributes: { fileSize: 500 },
        collectionRule: { type: "recommends" },
      },
    } as any;

    expect(calculateCollectionSize(mods)).toBe(100);
  });

  it("falls back to reference.fileSize when mod attribute is missing", () => {
    const mods = {
      m1: {
        attributes: {},
        collectionRule: { type: "requires", reference: { fileSize: 50 } },
      },
    } as any;

    expect(calculateCollectionSize(mods)).toBe(50);
  });

  it("treats missing size as 0", () => {
    const mods = {
      m1: {
        attributes: {},
        collectionRule: { type: "requires", reference: {} },
      },
    } as any;

    expect(calculateCollectionSize(mods)).toBe(0);
  });

  it("returns 0 for empty mods", () => {
    expect(calculateCollectionSize({})).toBe(0);
  });

  it("includes ignored=false requires mods", () => {
    const mods = {
      m1: {
        attributes: { fileSize: 100 },
        collectionRule: { type: "requires", ignored: false },
      },
    } as any;

    expect(calculateCollectionSize(mods)).toBe(100);
  });

  it("excludes ignored mods", () => {
    const mods = {
      m1: {
        attributes: { fileSize: 100 },
        collectionRule: { type: "requires", ignored: true },
      },
    } as any;

    expect(calculateCollectionSize(mods)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

describe("isEmpty", () => {
  it("returns true for undefined", () => {
    expect(isEmpty(undefined)).toBe(true);
  });

  it("returns true for null", () => {
    expect(isEmpty(null)).toBe(true);
  });

  it("returns true for empty string", () => {
    expect(isEmpty("")).toBe(true);
  });

  it("returns true for empty array", () => {
    expect(isEmpty([])).toBe(true);
  });

  it("returns true for empty object", () => {
    expect(isEmpty({})).toBe(true);
  });

  it("returns false for non-empty string", () => {
    expect(isEmpty("hello")).toBe(false);
  });

  it("returns false for non-empty array", () => {
    expect(isEmpty([1])).toBe(false);
  });

  it("returns false for non-empty object", () => {
    expect(isEmpty({ a: 1 })).toBe(false);
  });

  it("returns true for 0", () => {
    expect(isEmpty(0)).toBe(true);
  });
});
