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
  const makeModRef = (overrides: Record<string, any> = {}): any => ({
    versionMatch: "1.0.0",
    ...overrides,
  });

  const makeRule = (
    source: Record<string, any>,
    reference: Record<string, any>,
    type = "after",
  ): any => ({
    source: makeModRef(source),
    type,
    reference: makeModRef(reference),
  });

  it("returns a deep copy, not the same object", () => {
    const rule = makeRule(
      { logicalFileName: "A" },
      { versionMatch: "2.0.0", logicalFileName: "B" },
    );

    const result = postProcessRule(rule);
    expect(result).not.toBe(rule);
    expect(result.source).not.toBe(rule.source);
  });

  it("strips fileExpression from reference when version is fuzzy and logicalFileName exists", () => {
    const rule = makeRule(
      {},
      {
        versionMatch: "*",
        logicalFileName: "ModB",
        fileExpression: "ModB-v*.zip",
      },
    );

    const result = postProcessRule(rule);
    expect(result.reference.fileExpression).toBeUndefined();
    expect(result.reference.logicalFileName).toBe("ModB");
  });

  it("strips fileExpression from source when version is fuzzy and logicalFileName exists", () => {
    const rule = makeRule(
      {
        versionMatch: ">=1.0.0+prefer",
        logicalFileName: "ModA",
        fileExpression: "ModA-*.zip",
      },
      {},
      "before",
    );

    const result = postProcessRule(rule);
    expect(result.source.fileExpression).toBeUndefined();
    expect(result.source.logicalFileName).toBe("ModA");
  });

  it("keeps fileExpression when version is exact", () => {
    const rule = makeRule(
      {},
      {
        versionMatch: "2.0.0",
        logicalFileName: "ModB",
        fileExpression: "ModB-v2.zip",
      },
    );

    const result = postProcessRule(rule);
    expect(result.reference.fileExpression).toBe("ModB-v2.zip");
  });

  it("keeps fileExpression when logicalFileName is missing even if version is fuzzy", () => {
    const rule = makeRule(
      {},
      {
        versionMatch: "*",
        fileExpression: "ModB-v*.zip",
      },
    );

    const result = postProcessRule(rule);
    expect(result.reference.fileExpression).toBe("ModB-v*.zip");
  });

  it("handles both source and reference being fuzzy simultaneously", () => {
    const rule = makeRule(
      {
        versionMatch: "*",
        logicalFileName: "ModA",
        fileExpression: "ModA-*.zip",
      },
      {
        versionMatch: ">=2.0.0+prefer",
        logicalFileName: "ModB",
        fileExpression: "ModB-*.zip",
      },
    );

    const result = postProcessRule(rule);
    expect(result.source.fileExpression).toBeUndefined();
    expect(result.reference.fileExpression).toBeUndefined();
  });

  it("preserves other fields (type, other reference properties)", () => {
    const rule = makeRule(
      { id: "src-id", fileMD5: "abc" },
      { versionMatch: "2.0.0", id: "ref-id", fileMD5: "def" },
      "conflicts",
    );

    const result = postProcessRule(rule);
    expect(result.type).toBe("conflicts");
    expect(result.source.id).toBe("src-id");
    expect(result.reference.fileMD5).toBe("def");
  });
});
