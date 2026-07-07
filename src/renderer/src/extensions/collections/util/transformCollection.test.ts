import type { ILookupResult } from "modmeta-db";
import { describe, expect, it } from "vitest";

import { makeCollectionMod, makeGameStored } from "../../../test-utils/builders";
import type { IDialogContent } from "../../../types/IDialog";
import type { TFunction } from "../../../util/i18n";
import type { IMod, IModReference, IModRule } from "../../mod_management/types/IMod";
import { rulePhase } from "../../mod_management/util/rulePhase";
import type {
  ICollectionInfo,
  ICollectionMod,
  ICollectionModRule,
  ICollectionSourceInfo,
} from "../types/ICollection";
import { deterministicReferenceTag } from "./deterministicReferenceTag";
import {
  collectionModInstallSpec,
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
  const makeMod = (overrides: Record<string, unknown> = {}): IMod => ({
    id: "mod1",
    state: "installed",
    type: "mod",
    installationPath: "mods/mod1",
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

  const makeLookupResults = (value: Record<string, unknown>): ILookupResult[] => [
    { key: "k", value } as unknown as ILookupResult,
  ];

  const makeSourceInfo = (
    overrides: Partial<ICollectionSourceInfo> = {},
  ): ICollectionSourceInfo => ({
    type: "nexus",
    ...overrides,
  });

  /** Call deduceSource with sensible defaults for optional-in-practice args. */
  function callDeduce(
    mod: IMod,
    sourceInfo?: ICollectionSourceInfo,
    versionMatcher?: string,
    metaInfo: ILookupResult[] = [],
    tag = "tag1",
  ) {
    return deduceSource(mod, sourceInfo ?? undefined, versionMatcher ?? undefined, metaInfo, tag);
  }

  it("defaults to nexus source when sourceInfo is undefined", () => {
    const result = callDeduce(makeMod());

    expect(result.type).toBe("nexus");
    expect(result.modId).toBe(1234);
    expect(result.fileId).toBe(5678);
  });

  it("uses provided sourceInfo type", () => {
    const mod = makeMod({ source: "other" });
    const result = callDeduce(mod, makeSourceInfo({ type: "browse", url: "https://example.com" }));

    expect(result.type).toBe("browse");
    expect(result.url).toBe("https://example.com");
  });

  it("converts manual+url to browse", () => {
    const mod = makeMod({ source: "other" });
    const result = callDeduce(mod, makeSourceInfo({ type: "manual", url: "https://example.com" }));

    expect(result.type).toBe("browse");
  });

  it("throws when nexus mod lacks nexus source attribute", () => {
    const mod = makeMod({ source: "manual" });
    expect(() => callDeduce(mod)).toThrow("doesn't have Nexus as its source");
  });

  it("throws when nexus mod is missing modId", () => {
    const mod = makeMod({ modId: undefined });
    expect(() => callDeduce(mod)).toThrow("missing mod id or file id");
  });

  it("throws when nexus mod is missing fileId", () => {
    const mod = makeMod({ fileId: undefined });
    expect(() => callDeduce(mod)).toThrow("missing mod id or file id");
  });

  it("throws when browse/direct source has no url", () => {
    const mod = makeMod({ source: "other" });
    expect(() => callDeduce(mod, makeSourceInfo({ type: "direct" }))).toThrow("has no URL set");
  });

  it("does not assign md5 for bundle source", () => {
    const mod = makeMod({ source: "other" });
    const result = callDeduce(mod, makeSourceInfo({ type: "bundle" }));

    expect(result.md5).toBeUndefined();
  });

  it("assigns md5 from mod attributes for non-bundle", () => {
    const result = callDeduce(makeMod());

    expect(result.md5).toBe("abc123");
  });

  it("prefers metaInfo logicalFileName over mod attributes", () => {
    const metaInfo = makeLookupResults({ logicalFileName: "MetaLogicalName" });
    const result = callDeduce(makeMod(), undefined, undefined, metaInfo);

    expect(result.logicalFilename).toBe("MetaLogicalName");
  });

  it("falls back to mod logicalFileName when metaInfo is empty", () => {
    const result = callDeduce(makeMod());

    expect(result.logicalFilename).toBe("TestMod");
  });

  describe("updatePolicy deduction", () => {
    it("uses sourceInfo.updatePolicy when present", () => {
      const mod = makeMod({ source: "other" });
      const result = callDeduce(mod, makeSourceInfo({ type: "bundle", updatePolicy: "latest" }));

      expect(result.updatePolicy).toBe("latest");
    });

    it("defaults to exact for bundle without explicit policy", () => {
      const mod = makeMod({ source: "other" });
      const result = callDeduce(mod, makeSourceInfo({ type: "bundle" }));

      expect(result.updatePolicy).toBe("exact");
    });

    it("deduces latest when versionMatcher is *", () => {
      const result = callDeduce(makeMod(), undefined, "*");

      expect(result.updatePolicy).toBe("latest");
    });

    it("deduces prefer when versionMatcher ends with +prefer", () => {
      const result = callDeduce(makeMod(), undefined, ">=1.0.0+prefer");

      expect(result.updatePolicy).toBe("prefer");
    });

    it("deduces exact for any other versionMatcher", () => {
      const result = callDeduce(makeMod(), undefined, "1.0.0");

      expect(result.updatePolicy).toBe("exact");
    });
  });

  it("generates fileExpression from fileName when md5/logical/expression all missing", () => {
    const mod = makeMod({
      fileMD5: undefined,
      logicalFileName: undefined,
      fileName: "CoolMod-v2 (1).zip",
    });
    const result = callDeduce(mod);

    // sanitizeExpression strips extension and " (1)" suffix
    expect(result.fileExpression).toBe("CoolMod-v2");
  });

  it("assigns the tag", () => {
    const result = callDeduce(makeMod(), undefined, undefined, [], "my-tag");

    expect(result.tag).toBe("my-tag");
  });

  it("reads collectionId/revisionId for collection mod type", () => {
    const mod = makeMod({
      source: "nexus",
      collectionId: 111,
      revisionId: 222,
    });
    mod.type = "collection";
    const result = callDeduce(mod, undefined, undefined, [], "t");

    expect(result.modId).toBe(111);
    expect(result.fileId).toBe(222);
  });
});

// ---------------------------------------------------------------------------
// makeBiDirRule
// ---------------------------------------------------------------------------

describe("makeBiDirRule", () => {
  const makeRef = (overrides: Partial<IModReference> = {}): IModReference => ({
    id: "mod-id",
    ...overrides,
  });

  const makeBiDirTestRule = (overrides: Partial<IModRule> = {}): IModRule => ({
    type: "after",
    reference: makeRef(),
    ...overrides,
  });

  it("returns undefined when rule is undefined", () => {
    expect(makeBiDirRule(makeRef({ id: "src" }), undefined!)).toBeUndefined();
  });

  it("combines source and rule into a bidirectional rule", () => {
    const source = makeRef({ id: "src-mod" });
    const rule = makeBiDirTestRule({
      type: "after",
      reference: makeRef({ id: "target-mod" }),
    });

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
  const knownGames = [makeGameStored({ id: "skyrimse" })];

  it("creates a requires rule for a non-optional mod", () => {
    const result = collectionModToRule(knownGames, makeCollectionMod());

    expect(result.type).toBe("requires");
  });

  it("creates a recommends rule for an optional mod", () => {
    const result = collectionModToRule(knownGames, makeCollectionMod({ optional: true }));

    expect(result.type).toBe("recommends");
  });

  it("sets version match for exact updatePolicy", () => {
    const result = collectionModToRule(knownGames, makeCollectionMod());

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
    const result = collectionModToRule(knownGames, makeCollectionMod());

    expect(result.reference["repo"]).toBeDefined();
    expect(result.reference["repo"].repository).toBe("nexus");
    expect(result.reference["repo"].modId).toBe("100");
    expect(result.reference["repo"].fileId).toBe("200");
  });

  it("throws on nexus source without modId", () => {
    const mod = makeCollectionMod({
      source: { type: "nexus", modId: undefined, fileId: 200 },
    });
    expect(() => collectionModToRule(knownGames, mod)).toThrow("Invalid nexus repo specification");
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
    expect(result.downloadHint.url).toBe("https://example.com/download");
    expect(result.downloadHint.instructions).toBe("Click the big button");
    expect(result.downloadHint.mode).toBe("manual");
  });

  it("does not set downloadHint for nexus source", () => {
    const result = collectionModToRule(knownGames, makeCollectionMod());

    expect(result.downloadHint).toBeUndefined();
  });

  it("converts domainName to gameId via knownGames", () => {
    const result = collectionModToRule(knownGames, makeCollectionMod());

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
    const result = collectionModToRule(
      knownGames,
      makeCollectionMod({ instructions: "Install manually" }),
    );

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

  it("writes phase as a first-class rule field", () => {
    const result = collectionModToRule(knownGames, makeCollectionMod({ phase: 2 }));

    expect(result.phase).toBe(2);
    expect(rulePhase(result)).toBe(2);
  });

  it("defaults phase to 0 when not set", () => {
    const result = collectionModToRule(knownGames, makeCollectionMod());

    expect(result.phase).toBe(0);
    expect(rulePhase(result)).toBe(0);
  });

  it("maps the serialized install-spec field names onto the rule", () => {
    const fileList = [{ path: "a.esp", md5: "aaa" }];
    const choices = { type: "fomod", options: [] };
    const patches = { "a.esp": "baseline-hash" };
    const mod = makeCollectionMod({ hashes: fileList, choices, patches });

    // collectionModToRule must surface hashes -> fileList and choices -> installerChoices
    const rule = collectionModToRule(knownGames, mod);
    expect(rule.fileList).toEqual(fileList);
    expect(rule.installerChoices).toEqual(choices);
    expect(rule.patches).toEqual(patches);

    // and the single mapping helper it delegates to agrees
    expect(collectionModInstallSpec(mod)).toEqual({
      fileList,
      installerChoices: choices,
      patches,
    });
  });
});

// ---------------------------------------------------------------------------
// validateName
// ---------------------------------------------------------------------------

describe("validateName", () => {
  // Mock translation function: just returns the key
  const t = ((key: string) => key) as unknown as TFunction;

  const makeContent = (value: string | undefined): IDialogContent => ({
    input: [{ id: "name", value }],
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
    const result = validateName(t, makeContent(undefined));
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// generateCollection
// ---------------------------------------------------------------------------

describe("generateCollection", () => {
  it("wraps info, mods, and modRules into a collection", () => {
    const info = { name: "Test" } as ICollectionInfo;
    const mods = [{ name: "Mod1" }] as ICollectionMod[];
    const rules = [{ type: "after" }] as ICollectionModRule[];

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
  const makeMod = (id: string, overrides: Record<string, unknown> = {}): IMod => ({
    id,
    state: "installed",
    type: "",
    installationPath: `mods/${id}`,
    attributes: {
      fileMD5: "abc123",
      logicalFileName: "TestMod",
      version: "1.0.0",
      ...overrides,
    },
    rules: [],
  });

  const makeRule = (
    overrides: Partial<IModReference & Pick<IModRule, "fileList" | "comment">> = {},
  ): IModRule => ({
    type: "after",
    reference: {
      id: "target-mod",
      fileMD5: "def456",
      logicalFileName: "TargetMod",
      ...overrides,
    },
  });

  const makeCollection = (rules: Array<Partial<IModRule>> = []): IMod => ({
    id: "collection-1",
    state: "installed",
    type: "",
    installationPath: "mods/collection-1",
    attributes: {},
    rules: rules as IModRule[],
  });

  it("passes through a rule that has fileMD5", () => {
    const mods = { "target-mod": makeMod("target-mod") };
    const rule = makeRule();
    const collection = makeCollection([{ reference: { id: "target-mod" } }]);

    const result = makeTransferrable(mods, collection, rule);

    expect(result).toBeDefined();
    expect(result.type).toBe("after");
    expect(result.reference.fileMD5).toBe("def456");
  });

  it("passes through a rule that has logicalFileName but no md5", () => {
    const result = makeTransferrable({}, makeCollection(), makeRule({ fileMD5: undefined }));

    expect(result).toBeDefined();
    expect(result.reference.logicalFileName).toBe("TargetMod");
  });

  it("passes through a rule that has fileExpression but no md5/logical", () => {
    const result = makeTransferrable(
      {},
      makeCollection(),
      makeRule({
        fileMD5: undefined,
        logicalFileName: undefined,
        fileExpression: "TargetMod-*.zip",
      }),
    );

    expect(result).toBeDefined();
    expect(result.reference.fileExpression).toBe("TargetMod-*.zip");
  });

  it("returns undefined when rule has no matching markers and no id", () => {
    const result = makeTransferrable(
      {},
      makeCollection(),
      makeRule({
        id: undefined,
        fileMD5: undefined,
        logicalFileName: undefined,
        fileExpression: undefined,
      }),
    );

    expect(result).toBeUndefined();
  });

  it("returns undefined when rule has id but mod is not installed", () => {
    const result = makeTransferrable(
      {},
      makeCollection(),
      makeRule({
        fileMD5: undefined,
        logicalFileName: undefined,
        fileExpression: undefined,
      }),
    );

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
    const collection = makeCollection([{ reference: { id: "target-mod" } }]);

    const result = makeTransferrable(mods, collection, rule);

    expect(result).toBeDefined();
    expect(result.reference.fileMD5).toBe("rebuilt-hash");
  });

  it("promotes versionMatch to * when collection rule is wildcard", () => {
    // mod.fileMD5 must match the rule's reference.fileMD5 for testModReference
    // to recognise it as the same mod
    const mods = {
      "target-mod": makeMod("target-mod", { fileMD5: "def456" }),
    };
    const collection = makeCollection([{ reference: { id: "target-mod", versionMatch: "*" } }]);

    const result = makeTransferrable(mods, collection, makeRule());

    expect(result.reference.versionMatch).toBe("*");
  });

  it("promotes versionMatch to * when collection rule starts with >=", () => {
    const mods = {
      "target-mod": makeMod("target-mod", { fileMD5: "def456" }),
    };
    const collection = makeCollection([
      { reference: { id: "target-mod", versionMatch: ">=1.0.0" } },
    ]);

    const result = makeTransferrable(mods, collection, makeRule());

    expect(result.reference.versionMatch).toBe("*");
  });

  it("does not promote versionMatch when collection rule is exact", () => {
    const mods = { "target-mod": makeMod("target-mod") };
    const collection = makeCollection([{ reference: { id: "target-mod", versionMatch: "1.0.0" } }]);

    const result = makeTransferrable(mods, collection, makeRule());

    expect(result.reference.versionMatch).not.toBe("*");
  });

  it("preserves fileList and comment from the original rule", () => {
    const rule = makeRule({
      fileMD5: "abc",
      fileList: [{ path: "file.esp" }],
      comment: "load after this",
    });
    // fileList/comment are on the rule, not reference: fix the shape
    rule.fileList = [{ path: "file.esp" }];
    rule.comment = "load after this";

    const result = makeTransferrable({}, makeCollection(), rule);

    expect(result.fileList).toEqual([{ path: "file.esp" }]);
    expect(result.comment).toBe("load after this");
  });
});

// ---------------------------------------------------------------------------
// collectionModToRule - deterministic referenceTag fallback
// ---------------------------------------------------------------------------

describe("collectionModToRule deterministic referenceTag", () => {
  const knownGames = [makeGameStored({ id: "skyrimse" })];

  // the shared builder defaults to a tagless nexus member (no source.tag, has md5) - exactly the
  // case that reaches the tag fallback (deterministic tag or random shortid). Bundles instead
  // carry a stored source.tag and so never reach the fallback.
  const withMd5 = (md5: string) =>
    makeCollectionMod({ source: { ...makeCollectionMod().source, md5 } });

  it("uses a random tag for a tagless member in legacy (non-deterministic) mode", () => {
    const a = collectionModToRule(knownGames, makeCollectionMod());
    const b = collectionModToRule(knownGames, makeCollectionMod());
    expect(a.reference.tag).toBeDefined();
    expect(a.reference.tag).not.toBe(b.reference.tag);
  });

  it("derives a stable tag from file identity + install spec in deterministic mode", () => {
    const a = collectionModToRule(knownGames, makeCollectionMod(), true);
    const b = collectionModToRule(knownGames, makeCollectionMod(), true);
    expect(a.reference.tag).toBe(b.reference.tag);
    // and it is exactly the deterministicReferenceTag of the reference + install spec
    expect(a.reference.tag).toBe(
      deterministicReferenceTag(a.reference, collectionModInstallSpec(makeCollectionMod())),
    );
  });

  it("changes the deterministic tag when the file hash changes", () => {
    const a = collectionModToRule(knownGames, withMd5("hash-a"), true);
    const b = collectionModToRule(knownGames, withMd5("hash-b"), true);
    expect(a.reference.tag).not.toBe(b.reference.tag);
  });

  it("keeps a stored tag regardless of mode (bundle members)", () => {
    const stored = makeCollectionMod({
      source: { ...makeCollectionMod().source, tag: "stored-tag" },
    });
    expect(collectionModToRule(knownGames, stored).reference.tag).toBe("stored-tag");
    expect(collectionModToRule(knownGames, stored, true).reference.tag).toBe("stored-tag");
  });

  it("derives a stable modId-based tag for a fuzzy (latest) rule across differing file hashes", () => {
    // a latest/prefer member floats across versions, so its tag must key on the mod page
    // (repo.modId), not the version-specific fileMD5. Two resolutions of the same mod with
    // different md5 must yield the SAME deterministic tag - and a real hash, not a random shortid.
    const latest = (md5: string) =>
      makeCollectionMod({ source: { ...makeCollectionMod().source, updatePolicy: "latest", md5 } });
    const a = collectionModToRule(knownGames, latest("v1-md5"), true);
    const b = collectionModToRule(knownGames, latest("v2-md5"), true);

    expect(a.reference.tag).toBe(b.reference.tag);
    // md5 hex (deterministic) is 32 chars; a shortid fallback would not match this
    expect(a.reference.tag).toMatch(/^[0-9a-f]{32}$/);
  });
});
