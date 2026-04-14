import { describe, expect, it } from "vitest";

import { isFuzzyVersion, postProcessRule } from "./importCollection";

// ---------------------------------------------------------------------------
// isFuzzyVersion
// ---------------------------------------------------------------------------

describe("isFuzzyVersion", () => {
  it("returns true for wildcard *", () => {
    expect(isFuzzyVersion("*")).toBe(true);
  });

  it("returns true for +prefer suffix", () => {
    expect(isFuzzyVersion(">=1.0.0+prefer")).toBe(true);
  });

  it("returns false for an exact version", () => {
    expect(isFuzzyVersion("1.2.3")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isFuzzyVersion(undefined as any)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isFuzzyVersion(null as any)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isFuzzyVersion("")).toBe(false);
  });

  it("returns false for >= without +prefer", () => {
    expect(isFuzzyVersion(">=1.0.0")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// postProcessRule
// ---------------------------------------------------------------------------

describe("postProcessRule", () => {
  it("returns a deep copy, not the same object", () => {
    const rule = {
      source: { versionMatch: "1.0.0", logicalFileName: "A" },
      type: "after",
      reference: { versionMatch: "2.0.0", logicalFileName: "B" },
    } as any;

    const result = postProcessRule(rule);
    expect(result).not.toBe(rule);
    expect(result.source).not.toBe(rule.source);
  });

  it("strips fileExpression from reference when version is fuzzy and logicalFileName exists", () => {
    const rule = {
      source: { versionMatch: "1.0.0" },
      type: "after",
      reference: {
        versionMatch: "*",
        logicalFileName: "ModB",
        fileExpression: "ModB-v*.zip",
      },
    } as any;

    const result = postProcessRule(rule);
    expect(result.reference.fileExpression).toBeUndefined();
    expect(result.reference.logicalFileName).toBe("ModB");
  });

  it("strips fileExpression from source when version is fuzzy and logicalFileName exists", () => {
    const rule = {
      source: {
        versionMatch: ">=1.0.0+prefer",
        logicalFileName: "ModA",
        fileExpression: "ModA-*.zip",
      },
      type: "before",
      reference: { versionMatch: "1.0.0" },
    } as any;

    const result = postProcessRule(rule);
    expect(result.source.fileExpression).toBeUndefined();
    expect(result.source.logicalFileName).toBe("ModA");
  });

  it("keeps fileExpression when version is exact", () => {
    const rule = {
      source: { versionMatch: "1.0.0" },
      type: "after",
      reference: {
        versionMatch: "2.0.0",
        logicalFileName: "ModB",
        fileExpression: "ModB-v2.zip",
      },
    } as any;

    const result = postProcessRule(rule);
    expect(result.reference.fileExpression).toBe("ModB-v2.zip");
  });

  it("keeps fileExpression when logicalFileName is missing even if version is fuzzy", () => {
    const rule = {
      source: { versionMatch: "1.0.0" },
      type: "after",
      reference: {
        versionMatch: "*",
        fileExpression: "ModB-v*.zip",
      },
    } as any;

    const result = postProcessRule(rule);
    expect(result.reference.fileExpression).toBe("ModB-v*.zip");
  });

  it("handles both source and reference being fuzzy simultaneously", () => {
    const rule = {
      source: {
        versionMatch: "*",
        logicalFileName: "ModA",
        fileExpression: "ModA-*.zip",
      },
      type: "after",
      reference: {
        versionMatch: ">=2.0.0+prefer",
        logicalFileName: "ModB",
        fileExpression: "ModB-*.zip",
      },
    } as any;

    const result = postProcessRule(rule);
    expect(result.source.fileExpression).toBeUndefined();
    expect(result.reference.fileExpression).toBeUndefined();
  });

  it("preserves other fields (type, other reference properties)", () => {
    const rule = {
      source: { versionMatch: "1.0.0", id: "src-id", fileMD5: "abc" },
      type: "conflicts",
      reference: { versionMatch: "2.0.0", id: "ref-id", fileMD5: "def" },
    } as any;

    const result = postProcessRule(rule);
    expect(result.type).toBe("conflicts");
    expect(result.source.id).toBe("src-id");
    expect(result.reference.fileMD5).toBe("def");
  });
});
