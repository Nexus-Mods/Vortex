import { describe, expect, it } from "vitest";

import {
  collectionModToRule,
  deduceSource,
  generateCollection,
  makeBiDirRule,
  makeCollectionId,
  makeTransferrable,
  sanitizeExpression,
  toInt,
  validateName,
} from "./transformCollection";

// ---------------------------------------------------------------------------
// toInt
// ---------------------------------------------------------------------------

describe("toInt", () => {
  it("returns 0 for undefined", () => {
    expect(toInt(undefined)).toBe(0);
  });

  it("returns 0 for null", () => {
    expect(toInt(null)).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(toInt("")).toBe(0);
  });

  it("returns 0 for 0", () => {
    expect(toInt(0)).toBe(0);
  });

  it("parses a numeric string", () => {
    expect(toInt("42")).toBe(42);
  });

  it("passes through a number", () => {
    expect(toInt(7)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// sanitizeExpression
// ---------------------------------------------------------------------------

describe("sanitizeExpression", () => {
  it("strips extension from a filename", () => {
    expect(sanitizeExpression("my-mod.zip")).toBe("my-mod");
  });

  it("strips trailing .N duplicate suffix", () => {
    expect(sanitizeExpression("my-mod.1.zip")).toBe("my-mod");
  });

  it("strips trailing (N) duplicate suffix", () => {
    expect(sanitizeExpression("my-mod (2).zip")).toBe("my-mod");
  });

  it("handles nested path by taking basename", () => {
    expect(sanitizeExpression("some/path/mod-name.7z")).toBe("mod-name");
  });

  it("handles filename with no extension", () => {
    // path.basename with extname returns the name without ext; for no-ext files
    // it returns the full name
    expect(sanitizeExpression("modfile")).toBe("modfile");
  });
});

// ---------------------------------------------------------------------------
// deduceSource
// ---------------------------------------------------------------------------

describe("deduceSource", () => {
  const makeMod = (overrides: Record<string, any> = {}): any => ({
    id: "mod1",
    type: "mod",
    attributes: {
      source: "nexus",
      modId: 1234,
      fileId: 5678,
      fileMD5: "abc123",
      fileSize: 1024,
      logicalFileName: "TestMod",
      fileName: "TestMod-1.0.zip",
      ...overrides,
    },
  });

  it("defaults to nexus source when sourceInfo is undefined", () => {
    const mod = makeMod();
    const result = deduceSource(mod, undefined as any, undefined as any, [], "tag1");

    expect(result.type).toBe("nexus");
    expect(result.modId).toBe(1234);
    expect(result.fileId).toBe(5678);
  });

  it("uses provided sourceInfo type", () => {
    const mod = makeMod({ source: "other" });
    const sourceInfo = { type: "browse" as const, url: "https://example.com" };
    const result = deduceSource(mod, sourceInfo as any, undefined as any, [], "tag1");

    expect(result.type).toBe("browse");
    expect(result.url).toBe("https://example.com");
  });

  it("converts manual+url to browse", () => {
    const mod = makeMod({ source: "other" });
    const sourceInfo = { type: "manual" as const, url: "https://example.com" };
    const result = deduceSource(mod, sourceInfo as any, undefined as any, [], "tag1");

    expect(result.type).toBe("browse");
  });

  it("throws when nexus mod lacks nexus source attribute", () => {
    const mod = makeMod({ source: "manual" });
    expect(() =>
      deduceSource(mod, undefined as any, undefined as any, [], "tag1"),
    ).toThrow("doesn't have Nexus as its source");
  });

  it("throws when nexus mod is missing modId", () => {
    const mod = makeMod({ modId: undefined });
    expect(() =>
      deduceSource(mod, undefined as any, undefined as any, [], "tag1"),
    ).toThrow("missing mod id or file id");
  });

  it("throws when nexus mod is missing fileId", () => {
    const mod = makeMod({ fileId: undefined });
    expect(() =>
      deduceSource(mod, undefined as any, undefined as any, [], "tag1"),
    ).toThrow("missing mod id or file id");
  });

  it("throws when browse/direct source has no url", () => {
    const mod = makeMod({ source: "other" });
    const sourceInfo = { type: "direct" as const };
    expect(() =>
      deduceSource(mod, sourceInfo as any, undefined as any, [], "tag1"),
    ).toThrow("has no URL set");
  });

  it("does not assign md5 for bundle source", () => {
    const mod = makeMod({ source: "other" });
    const sourceInfo = { type: "bundle" as const };
    const result = deduceSource(mod, sourceInfo as any, undefined as any, [], "tag1");

    expect(result.md5).toBeUndefined();
  });

  it("assigns md5 from mod attributes for non-bundle", () => {
    const mod = makeMod();
    const result = deduceSource(mod, undefined as any, undefined as any, [], "tag1");

    expect(result.md5).toBe("abc123");
  });

  it("prefers metaInfo logicalFileName over mod attributes", () => {
    const mod = makeMod();
    const metaInfo = [{ value: { logicalFileName: "MetaLogicalName" } }];
    const result = deduceSource(mod, undefined as any, undefined as any, metaInfo, "tag1");

    expect(result.logicalFilename).toBe("MetaLogicalName");
  });

  it("falls back to mod logicalFileName when metaInfo is empty", () => {
    const mod = makeMod();
    const result = deduceSource(mod, undefined as any, undefined as any, [], "tag1");

    expect(result.logicalFilename).toBe("TestMod");
  });

  describe("updatePolicy deduction", () => {
    it("uses sourceInfo.updatePolicy when present", () => {
      const mod = makeMod({ source: "other" });
      const sourceInfo = {
        type: "bundle" as const,
        updatePolicy: "latest" as const,
      };
      const result = deduceSource(mod, sourceInfo as any, undefined as any, [], "tag1");

      expect(result.updatePolicy).toBe("latest");
    });

    it("defaults to exact for bundle without explicit policy", () => {
      const mod = makeMod({ source: "other" });
      const sourceInfo = { type: "bundle" as const };
      const result = deduceSource(mod, sourceInfo as any, undefined as any, [], "tag1");

      expect(result.updatePolicy).toBe("exact");
    });

    it("deduces latest when versionMatcher is *", () => {
      const mod = makeMod();
      const result = deduceSource(mod, undefined as any, "*", [], "tag1");

      expect(result.updatePolicy).toBe("latest");
    });

    it("deduces prefer when versionMatcher ends with +prefer", () => {
      const mod = makeMod();
      const result = deduceSource(
        mod,
        undefined as any,
        ">=1.0.0+prefer",
        [],
        "tag1",
      );

      expect(result.updatePolicy).toBe("prefer");
    });

    it("deduces exact for any other versionMatcher", () => {
      const mod = makeMod();
      const result = deduceSource(mod, undefined as any, "1.0.0", [], "tag1");

      expect(result.updatePolicy).toBe("exact");
    });
  });

  it("generates fileExpression from fileName when md5/logical/expression all missing", () => {
    const mod = makeMod({
      fileMD5: undefined,
      logicalFileName: undefined,
      fileName: "CoolMod-v2 (1).zip",
    });
    const result = deduceSource(mod, undefined as any, undefined as any, [], "tag1");

    // sanitizeExpression strips extension and " (1)" suffix
    expect(result.fileExpression).toBe("CoolMod-v2");
  });

  it("assigns the tag", () => {
    const mod = makeMod();
    const result = deduceSource(mod, undefined as any, undefined as any, [], "my-tag");

    expect(result.tag).toBe("my-tag");
  });

  it("reads collectionId/revisionId for collection mod type", () => {
    const mod = {
      id: "col-mod",
      type: "collection",
      attributes: {
        source: "nexus",
        collectionId: 111,
        revisionId: 222,
        fileMD5: "hash",
        fileSize: 500,
      },
    };
    const result = deduceSource(mod as any, undefined as any, undefined as any, [], "t");

    expect(result.modId).toBe(111);
    expect(result.fileId).toBe(222);
  });
});

// ---------------------------------------------------------------------------
// makeBiDirRule
// ---------------------------------------------------------------------------

describe("makeBiDirRule", () => {
  it("returns undefined when rule is undefined", () => {
    expect(makeBiDirRule({ id: "src" } as any, undefined as any)).toBeUndefined();
  });

  it("combines source and rule into a bidirectional rule", () => {
    const source = { id: "src-mod" } as any;
    const rule = {
      type: "after",
      reference: { id: "target-mod" },
    } as any;

    const result = makeBiDirRule(source, rule);

    expect(result).toEqual({
      type: "after",
      reference: { id: "target-mod" },
      source: { id: "src-mod" },
    });
  });
});

// ---------------------------------------------------------------------------
// collectionModToRule
// ---------------------------------------------------------------------------

describe("collectionModToRule", () => {
  const knownGames = [
    { id: "skyrimse", domainName: "skyrimspecialedition" },
  ] as any[];

  const makeCollectionMod = (overrides: Record<string, any> = {}): any => ({
    name: "Test Mod",
    version: "1.2.3",
    optional: false,
    domainName: "skyrimspecialedition",
    source: {
      type: "nexus",
      modId: 100,
      fileId: 200,
      md5: "abc",
      fileSize: 1024,
      logicalFilename: "TestMod",
      updatePolicy: "exact",
    },
    ...overrides,
  });

  it("creates a requires rule for a non-optional mod", () => {
    const mod = makeCollectionMod();
    const result = collectionModToRule(knownGames, mod);

    expect(result.type).toBe("requires");
  });

  it("creates a recommends rule for an optional mod", () => {
    const mod = makeCollectionMod({ optional: true });
    const result = collectionModToRule(knownGames, mod);

    expect(result.type).toBe("recommends");
  });

  it("sets version match for exact updatePolicy", () => {
    const mod = makeCollectionMod();
    const result = collectionModToRule(knownGames, mod);

    // coerceToSemver("1.2.3") = "1.2.3"
    expect(result.reference.versionMatch).toBe("1.2.3");
  });

  it("sets versionMatch to * for latest updatePolicy", () => {
    const mod = makeCollectionMod({
      source: {
        ...makeCollectionMod().source,
        updatePolicy: "latest",
      },
    });
    const result = collectionModToRule(knownGames, mod);

    expect(result.reference.versionMatch).toBe("*");
  });

  it("sets versionMatch with +prefer suffix for prefer updatePolicy", () => {
    const mod = makeCollectionMod({
      source: {
        ...makeCollectionMod().source,
        updatePolicy: "prefer",
      },
    });
    const result = collectionModToRule(knownGames, mod);

    expect(result.reference.versionMatch).toContain("+prefer");
  });

  it("clears fileMD5 for bundle source", () => {
    const mod = makeCollectionMod({
      source: {
        type: "bundle",
        fileExpression: "my-bundle",
        updatePolicy: "exact",
      },
    });
    const result = collectionModToRule(knownGames, mod);

    expect(result.reference.fileMD5).toBeUndefined();
  });

  it("sets nexus repo reference", () => {
    const mod = makeCollectionMod();
    const result = collectionModToRule(knownGames, mod);

    expect(result.reference["repo"]).toBeDefined();
    expect(result.reference["repo"].repository).toBe("nexus");
    expect(result.reference["repo"].modId).toBe("100");
    expect(result.reference["repo"].fileId).toBe("200");
  });

  it("throws on nexus source without modId", () => {
    const mod = makeCollectionMod({
      source: { type: "nexus", modId: undefined, fileId: 200 },
    });
    expect(() => collectionModToRule(knownGames, mod)).toThrow(
      "Invalid nexus repo specification",
    );
  });

  it("sets downloadHint for manual source", () => {
    const mod = makeCollectionMod({
      source: {
        type: "manual",
        url: "https://example.com/download",
        instructions: "Click the big button",
        updatePolicy: "exact",
      },
    });
    const result = collectionModToRule(knownGames, mod);

    expect(result.downloadHint).toBeDefined();
    expect(result.downloadHint!.url).toBe("https://example.com/download");
    expect(result.downloadHint!.instructions).toBe("Click the big button");
    expect(result.downloadHint!.mode).toBe("manual");
  });

  it("does not set downloadHint for nexus source", () => {
    const mod = makeCollectionMod();
    const result = collectionModToRule(knownGames, mod);

    expect(result.downloadHint).toBeUndefined();
  });

  it("converts domainName to gameId via knownGames", () => {
    const mod = makeCollectionMod();
    const result = collectionModToRule(knownGames, mod);

    expect(result.reference.gameId).toBe("skyrimse");
  });

  it("sets bundle localPath in extra", () => {
    const mod = makeCollectionMod({
      source: {
        type: "bundle",
        fileExpression: "my-bundle-file",
        updatePolicy: "exact",
      },
    });
    const result = collectionModToRule(knownGames, mod);

    expect(result.extra.localPath).toMatch(/bundled/);
    expect(result.extra.localPath).toContain("my-bundle-file");
  });

  it("includes mod instructions in extra", () => {
    const mod = makeCollectionMod({ instructions: "Install manually" });
    const result = collectionModToRule(knownGames, mod);

    expect(result.extra.instructions).toBe("Install manually");
  });

  it("sets md5Hint for latest updatePolicy", () => {
    const mod = makeCollectionMod({
      source: {
        ...makeCollectionMod().source,
        updatePolicy: "latest",
        md5: "hashvalue",
      },
    });
    const result = collectionModToRule(knownGames, mod);

    expect(result.reference["md5Hint"]).toBe("hashvalue");
  });

  it("preserves phase in extra", () => {
    const mod = makeCollectionMod({ phase: 2 });
    const result = collectionModToRule(knownGames, mod);

    expect(result.extra.phase).toBe(2);
  });

  it("defaults phase to 0 when not set", () => {
    const mod = makeCollectionMod();
    const result = collectionModToRule(knownGames, mod);

    expect(result.extra.phase).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// validateName
// ---------------------------------------------------------------------------

describe("validateName", () => {
  // Mock translation function — just returns the key
  const t = ((key: string) => key) as any;

  const makeContent = (value: string): any => ({
    input: [{ value }],
  });

  it("returns no errors for a valid name", () => {
    const result = validateName(t, makeContent("My Collection"));
    expect(result).toEqual([]);
  });

  it("returns no errors at minimum length (3 chars)", () => {
    const result = validateName(t, makeContent("abc"));
    expect(result).toEqual([]);
  });

  it("returns no errors at maximum length (36 chars)", () => {
    const result = validateName(t, makeContent("a".repeat(36)));
    expect(result).toEqual([]);
  });

  it("returns an error for a name that is too short", () => {
    const result = validateName(t, makeContent("ab"));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("name");
    expect(result[0].actions).toContain("Create");
  });

  it("returns an error for a name that is too long", () => {
    const result = validateName(t, makeContent("a".repeat(37)));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("name");
  });

  it("returns an error for an empty name", () => {
    const result = validateName(t, makeContent(""));
    expect(result).toHaveLength(1);
  });

  it("treats undefined input value as empty string", () => {
    const result = validateName(t, { input: [{ value: undefined }] });
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// generateCollection
// ---------------------------------------------------------------------------

describe("generateCollection", () => {
  it("wraps info, mods, and modRules into a collection", () => {
    const info = { name: "Test" } as any;
    const mods = [{ name: "Mod1" }] as any;
    const rules = [{ type: "after" }] as any;

    const result = generateCollection(info, mods, rules);

    expect(result).toEqual({ info, mods, modRules: rules });
  });
});

// ---------------------------------------------------------------------------
// makeCollectionId
// ---------------------------------------------------------------------------

describe("makeCollectionId", () => {
  it("prefixes the base id", () => {
    expect(makeCollectionId("abc123")).toBe("vortex_collection_abc123");
  });
});

// ---------------------------------------------------------------------------
// makeTransferrable
// ---------------------------------------------------------------------------

describe("makeTransferrable", () => {
  const makeMod = (id: string, overrides: Record<string, any> = {}): any => ({
    id,
    attributes: {
      fileMD5: "abc123",
      logicalFileName: "TestMod",
      version: "1.0.0",
      ...overrides,
    },
    rules: [],
  });

  const makeRule = (overrides: Record<string, any> = {}): any => ({
    type: "after",
    reference: {
      id: "target-mod",
      fileMD5: "def456",
      logicalFileName: "TargetMod",
      ...overrides,
    },
  });

  const makeCollection = (rules: any[] = []): any => ({
    id: "collection-1",
    rules,
  });

  it("passes through a rule that has fileMD5", () => {
    const mods = { "target-mod": makeMod("target-mod") };
    const rule = makeRule();
    const collection = makeCollection([
      { reference: { id: "target-mod" } },
    ]);

    const result = makeTransferrable(mods, collection, rule);

    expect(result).toBeDefined();
    expect(result.type).toBe("after");
    expect(result.reference.fileMD5).toBe("def456");
  });

  it("passes through a rule that has logicalFileName but no md5", () => {
    const mods = {};
    const rule = makeRule({ fileMD5: undefined });
    const collection = makeCollection();

    const result = makeTransferrable(mods, collection, rule);

    expect(result).toBeDefined();
    expect(result.reference.logicalFileName).toBe("TargetMod");
  });

  it("passes through a rule that has fileExpression but no md5/logical", () => {
    const mods = {};
    const rule = makeRule({
      fileMD5: undefined,
      logicalFileName: undefined,
      fileExpression: "TargetMod-*.zip",
    });
    const collection = makeCollection();

    const result = makeTransferrable(mods, collection, rule);

    expect(result).toBeDefined();
    expect(result.reference.fileExpression).toBe("TargetMod-*.zip");
  });

  it("returns undefined when rule has no matching markers and no id", () => {
    const mods = {};
    const rule = makeRule({
      id: undefined,
      fileMD5: undefined,
      logicalFileName: undefined,
      fileExpression: undefined,
    });
    const collection = makeCollection();

    const result = makeTransferrable(mods, collection, rule);

    expect(result).toBeUndefined();
  });

  it("returns undefined when rule has id but mod is not installed", () => {
    const mods = {}; // target-mod is not in mods
    const rule = makeRule({
      fileMD5: undefined,
      logicalFileName: undefined,
      fileExpression: undefined,
    });
    const collection = makeCollection();

    const result = makeTransferrable(mods, collection, rule);

    expect(result).toBeUndefined();
  });

  it("rebuilds reference from mod when rule has no markers but mod exists", () => {
    const mods = {
      "target-mod": makeMod("target-mod", {
        fileMD5: "rebuilt-hash",
        logicalFileName: "RebuiltName",
      }),
    };
    const rule = makeRule({
      fileMD5: undefined,
      logicalFileName: undefined,
      fileExpression: undefined,
    });
    const collection = makeCollection([
      { reference: { id: "target-mod" } },
    ]);

    const result = makeTransferrable(mods, collection, rule);

    expect(result).toBeDefined();
    // makeModReference builds a new reference from the mod
    expect(result.reference.fileMD5).toBe("rebuilt-hash");
  });

  it("promotes versionMatch to * when collection rule is wildcard", () => {
    const mods = { "target-mod": makeMod("target-mod") };
    const rule = makeRule();
    const collection = makeCollection([
      { reference: { id: "target-mod", versionMatch: "*" } },
    ]);

    const result = makeTransferrable(mods, collection, rule);

    expect(result.reference.versionMatch).toBe("*");
  });

  it("promotes versionMatch to * when collection rule starts with >=", () => {
    const mods = { "target-mod": makeMod("target-mod") };
    const rule = makeRule();
    const collection = makeCollection([
      { reference: { id: "target-mod", versionMatch: ">=1.0.0" } },
    ]);

    const result = makeTransferrable(mods, collection, rule);

    expect(result.reference.versionMatch).toBe("*");
  });

  it("does not promote versionMatch when collection rule is exact", () => {
    const mods = { "target-mod": makeMod("target-mod") };
    const rule = makeRule();
    const collection = makeCollection([
      { reference: { id: "target-mod", versionMatch: "1.0.0" } },
    ]);

    const result = makeTransferrable(mods, collection, rule);

    // should preserve the original versionMatch from the rule reference
    expect(result.reference.versionMatch).not.toBe("*");
  });

  it("preserves fileList and comment from the original rule", () => {
    const mods = {};
    const rule = {
      type: "after",
      reference: { fileMD5: "abc" },
      fileList: [{ path: "file.esp" }],
      comment: "load after this",
    } as any;
    const collection = makeCollection();

    const result = makeTransferrable(mods, collection, rule);

    expect(result.fileList).toEqual([{ path: "file.esp" }]);
    expect(result.comment).toBe("load after this");
  });
});
