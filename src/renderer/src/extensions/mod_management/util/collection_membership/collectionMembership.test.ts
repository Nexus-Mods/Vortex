import { describe, expect, it, vi } from "vitest";

import { makeInstalledCollection, makeMod, makeRule } from "../../../../test-utils/builders";
import { test } from "../../../../test-utils/harnessTest";
import type { IApiHarness } from "../../../../test-utils/harnessTypes";
import type { IMod, IModRule } from "../../types/IMod";
import { collectionNamesByMod, ignorePinnedCollectionRules } from "./collectionMembership";

vi.mock("../../../../util/log", () => ({
  log: vi.fn(),
}));

const requiresRule = (fileMD5: string): IModRule => makeRule({ reference: { fileMD5 } });

const createCollection = (id: string, name: string, rules: IModRule[]): IMod =>
  makeInstalledCollection({ id, attributes: { customFileName: name }, rules });

const toMap = (...mods: IMod[]) => Object.fromEntries(mods.map((mod) => [mod.id, mod]));

describe("collectionNamesByMod", () => {
  const memberA = makeMod({ id: "member-a", attributes: { fileMD5: "md5-a", fileName: "a.7z" } });
  const memberB = makeMod({ id: "member-b", attributes: { fileMD5: "md5-b", fileName: "b.7z" } });
  const standalone = makeMod({
    id: "standalone",
    attributes: { fileMD5: "md5-x", fileName: "x.7z" },
  });

  it("returns nothing when no collection is installed", () => {
    const mods = toMap(memberA, standalone);

    expect(collectionNamesByMod(mods, ["member-a", "standalone"])).toEqual({});
  });

  it("names the collection a mod belongs to", () => {
    const collection = createCollection("col-1", "Immersive and Adult", [requiresRule("md5-a")]);
    const mods = toMap(collection, memberA, standalone);

    expect(collectionNamesByMod(mods, ["member-a", "standalone"])).toEqual({
      "member-a": ["Immersive and Adult"],
    });
  });

  it("lists every collection a mod belongs to", () => {
    const first = createCollection("col-1", "First", [requiresRule("md5-a")]);
    const second = createCollection("col-2", "Second", [requiresRule("md5-a")]);
    const mods = toMap(first, second, memberA);

    expect(collectionNamesByMod(mods, ["member-a"])).toEqual({
      "member-a": ["First", "Second"],
    });
  });

  it("counts recommended members as part of the collection", () => {
    const collection = createCollection("col-1", "Optional Pack", [
      makeRule({ type: "recommends", reference: { fileMD5: "md5-b" } }),
    ]);
    const mods = toMap(collection, memberB);

    expect(collectionNamesByMod(mods, ["member-b"])).toEqual({ "member-b": ["Optional Pack"] });
  });

  it("ignores rules that do not add a mod", () => {
    const collection = createCollection("col-1", "Ordering Only", [
      makeRule({ type: "before", reference: { fileMD5: "md5-a" } }),
    ]);
    const mods = toMap(collection, memberA);

    expect(collectionNamesByMod(mods, ["member-a"])).toEqual({});
  });

  it("only reports the requested mods", () => {
    const collection = createCollection("col-1", "Pack", [
      requiresRule("md5-a"),
      requiresRule("md5-b"),
    ]);
    const mods = toMap(collection, memberA, memberB);

    expect(collectionNamesByMod(mods, ["member-b"])).toEqual({ "member-b": ["Pack"] });
  });

  it("never reports a collection mod itself", () => {
    const collection = createCollection("col-1", "Pack", [requiresRule("md5-a")]);
    const mods = toMap(collection, memberA);

    expect(collectionNamesByMod(mods, ["col-1"])).toEqual({});
  });

  it("skips ids that are not installed", () => {
    const collection = createCollection("col-1", "Pack", [requiresRule("md5-a")]);
    const mods = toMap(collection, memberA);

    expect(collectionNamesByMod(mods, ["missing"])).toEqual({});
  });
});

describe("ignorePinnedCollectionRules", () => {
  const GAME = "skyrimse";
  const memberA = makeMod({ id: "member-a", attributes: { fileMD5: "md5-a", version: "1.0.0" } });
  const memberB = makeMod({ id: "member-b", attributes: { fileMD5: "md5-b", version: "1.0.0" } });

  const rulesOf = (harness: IApiHarness, collectionId: string) =>
    harness.getState().persistent.mods[GAME][collectionId].rules;

  test("ignores the rule that pins the updated mod's version", ({ makeApi }) => {
    const pinned = requiresRule("md5-a");
    const harness = makeApi({
      mods: { [GAME]: toMap(createCollection("col-1", "Pack", [pinned]), memberA) },
    });

    ignorePinnedCollectionRules(harness.api, GAME, ["member-a"]);

    expect(rulesOf(harness, "col-1")).toEqual([{ ...pinned, ignored: true }]);
  });

  test("leaves a rule that follows the mod's latest version", ({ makeApi }) => {
    const latest = makeRule({
      reference: { fileMD5: "md5-a", logicalFileName: "a", versionMatch: "*" },
    });
    const harness = makeApi({
      mods: { [GAME]: toMap(createCollection("col-1", "Pack", [latest]), memberA) },
    });

    ignorePinnedCollectionRules(harness.api, GAME, ["member-a"]);

    expect(rulesOf(harness, "col-1")).toEqual([latest]);
  });

  test("leaves the rule of an optional member", ({ makeApi }) => {
    const optional = makeRule({ type: "recommends", reference: { fileMD5: "md5-a" } });
    const harness = makeApi({
      mods: { [GAME]: toMap(createCollection("col-1", "Pack", [optional]), memberA) },
    });

    ignorePinnedCollectionRules(harness.api, GAME, ["member-a"]);

    expect(rulesOf(harness, "col-1")).toEqual([optional]);
  });

  test("leaves the rules of members that are not updated", ({ makeApi }) => {
    const pinnedA = requiresRule("md5-a");
    const pinnedB = requiresRule("md5-b");
    const harness = makeApi({
      mods: {
        [GAME]: toMap(createCollection("col-1", "Pack", [pinnedA, pinnedB]), memberA, memberB),
      },
    });

    ignorePinnedCollectionRules(harness.api, GAME, ["member-a"]);

    expect(rulesOf(harness, "col-1")).toEqual([{ ...pinnedA, ignored: true }, pinnedB]);
  });

  test("ignores the pinning rule in every collection the mod belongs to", ({ makeApi }) => {
    const pinned = requiresRule("md5-a");
    const harness = makeApi({
      mods: {
        [GAME]: toMap(
          createCollection("col-1", "Pack", [pinned]),
          createCollection("col-2", "Other Pack", [pinned]),
          memberA,
        ),
      },
    });

    ignorePinnedCollectionRules(harness.api, GAME, ["member-a"]);

    expect(rulesOf(harness, "col-1")).toEqual([{ ...pinned, ignored: true }]);
    expect(rulesOf(harness, "col-2")).toEqual([{ ...pinned, ignored: true }]);
  });
});
