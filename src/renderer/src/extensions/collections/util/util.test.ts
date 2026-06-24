import type { ICollectionPermission } from "@nexusmods/nexus-api";
import { describe, expect, it } from "vitest";

import type { ICollectionModRuleEx } from "../types/ICollection";
import { getUnfulfilledNotificationId, hasEditPermissions, isEmpty, md5sum, ruleId } from "./util";

// ---------------------------------------------------------------------------
// Shared factories
// ---------------------------------------------------------------------------

const makeRuleEx = (overrides: Partial<ICollectionModRuleEx> = {}): ICollectionModRuleEx =>
  ({
    sourceName: "ModA",
    type: "after",
    referenceName: "ModB",
    ...overrides,
  }) as ICollectionModRuleEx;

// ---------------------------------------------------------------------------
// hasEditPermissions
// ---------------------------------------------------------------------------

describe("hasEditPermissions", () => {
  it("returns false for undefined permissions", () => {
    expect(hasEditPermissions(undefined as unknown as ICollectionPermission[])).toBe(false);
  });

  it("returns false for null permissions", () => {
    expect(hasEditPermissions(null as ICollectionPermission[])).toBe(false);
  });

  it("returns false when collection:edit is not present", () => {
    const perms = [
      { key: "collection:view" },
      { key: "collection:delete" },
    ] as unknown as ICollectionPermission[];
    expect(hasEditPermissions(perms)).toBe(false);
  });

  it("returns true when collection:edit is present", () => {
    const perms = [
      { key: "collection:view" },
      { key: "collection:edit" },
    ] as unknown as ICollectionPermission[];
    expect(hasEditPermissions(perms)).toBe(true);
  });

  it("returns false for empty array", () => {
    const perms: ICollectionPermission[] = [];
    expect(hasEditPermissions(perms)).toBe(false);
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
    const rule = makeRuleEx();
    const id = ruleId(rule);

    expect(id).toMatch(/^[0-9a-f]{32}$/);
    // Should be deterministic
    expect(ruleId(rule)).toBe(id);
  });

  it("produces different IDs for different rules", () => {
    const rule1 = makeRuleEx();
    const rule2 = makeRuleEx({ type: "before" });

    expect(ruleId(rule1)).not.toBe(ruleId(rule2));
  });

  it("produces different IDs when source/reference swap", () => {
    const rule1 = makeRuleEx();
    const rule2 = makeRuleEx({ sourceName: "ModB", referenceName: "ModA" });

    expect(ruleId(rule1)).not.toBe(ruleId(rule2));
  });
});

// ---------------------------------------------------------------------------
// getUnfulfilledNotificationId
// ---------------------------------------------------------------------------

describe("getUnfulfilledNotificationId", () => {
  it("returns a prefixed string", () => {
    expect(getUnfulfilledNotificationId("col123")).toBe("collection-incomplete-col123");
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
