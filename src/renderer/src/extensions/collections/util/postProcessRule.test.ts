import { describe, expect, it } from "vitest";

import { makeCollectionModRule, makeReference } from "../../../test-utils/builders";
import { postProcessRule } from "./postProcessRule";

describe("postProcessRule", () => {
  it("returns a deep copy, not the same object", () => {
    const rule = makeCollectionModRule({
      source: makeReference({ logicalFileName: "A" }),
      reference: makeReference({ versionMatch: "2.0.0", logicalFileName: "B" }),
    });

    const result = postProcessRule(rule);
    expect(result).not.toBe(rule);
    expect(result.source).not.toBe(rule.source);
  });

  it("strips fileExpression from reference when version is fuzzy and logicalFileName exists", () => {
    const rule = makeCollectionModRule({
      reference: makeReference({
        versionMatch: "*",
        logicalFileName: "ModB",
        fileExpression: "ModB-v*.zip",
      }),
    });

    const result = postProcessRule(rule);
    expect(result.reference.fileExpression).toBeUndefined();
    expect(result.reference.logicalFileName).toBe("ModB");
  });

  it("strips fileExpression from source when version is fuzzy and logicalFileName exists", () => {
    const rule = makeCollectionModRule({
      source: makeReference({
        versionMatch: ">=1.0.0+prefer",
        logicalFileName: "ModA",
        fileExpression: "ModA-*.zip",
      }),
      type: "before",
    });

    const result = postProcessRule(rule);
    expect(result.source.fileExpression).toBeUndefined();
    expect(result.source.logicalFileName).toBe("ModA");
  });

  it("keeps fileExpression when version is exact", () => {
    const rule = makeCollectionModRule({
      reference: makeReference({
        versionMatch: "2.0.0",
        logicalFileName: "ModB",
        fileExpression: "ModB-v2.zip",
      }),
    });

    const result = postProcessRule(rule);
    expect(result.reference.fileExpression).toBe("ModB-v2.zip");
  });

  it("keeps fileExpression when logicalFileName is missing even if version is fuzzy", () => {
    const rule = makeCollectionModRule({
      reference: makeReference({
        versionMatch: "*",
        fileExpression: "ModB-v*.zip",
      }),
    });

    const result = postProcessRule(rule);
    expect(result.reference.fileExpression).toBe("ModB-v*.zip");
  });

  it("handles both source and reference being fuzzy simultaneously", () => {
    const rule = makeCollectionModRule({
      source: makeReference({
        versionMatch: "*",
        logicalFileName: "ModA",
        fileExpression: "ModA-*.zip",
      }),
      reference: makeReference({
        versionMatch: ">=2.0.0+prefer",
        logicalFileName: "ModB",
        fileExpression: "ModB-*.zip",
      }),
    });

    const result = postProcessRule(rule);
    expect(result.source.fileExpression).toBeUndefined();
    expect(result.reference.fileExpression).toBeUndefined();
  });

  it("preserves other fields (type, other reference properties)", () => {
    const rule = makeCollectionModRule({
      source: makeReference({ id: "src-id", fileMD5: "abc" }),
      reference: makeReference({ versionMatch: "2.0.0", id: "ref-id", fileMD5: "def" }),
      type: "conflicts",
    });

    const result = postProcessRule(rule);
    expect(result.type).toBe("conflicts");
    expect(result.source.id).toBe("src-id");
    expect(result.reference.fileMD5).toBe("def");
  });
});
