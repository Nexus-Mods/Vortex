/**
 * Deciding whether an installed mod belongs to a collection, which is what lets a health check
 * leave a collection's members to the collection.
 */
import { describe, expect, it } from "vitest";

import { MOD_TYPE } from "@/extensions/collections/constants";
import type { IModRule } from "@/extensions/mod_management/types/IMod";
import { makeMod, makeProfile, makeReference, makeRule } from "@/test-utils/builders";

import { collectionManagedTags, isCollectionManaged } from "./collectionManaged";

const PROFILE = "prof-1";

const collectionMod = (id: string, tags: string[], type: IModRule["type"] = "requires") =>
  makeMod({
    id,
    type: MOD_TYPE,
    rules: tags.map((tag) => makeRule({ type, reference: makeReference({ tag }) })),
  });

// a profile that has every named collection installed
const profileWith = (...collectionIds: string[]) =>
  makeProfile({
    id: PROFILE,
    modState: Object.fromEntries(
      collectionIds.map((id) => [id, { enabled: true, enabledTime: 0 }]),
    ),
  });

describe("isCollectionManaged", () => {
  it("claims a mod carrying an installed collection's rule tag", () => {
    const mods = { "col-a": collectionMod("col-a", ["tag-a"]) };
    const tags = collectionManagedTags(mods, profileWith("col-a"));

    expect(isCollectionManaged(makeMod({ attributes: { referenceTag: "tag-a" } }), tags)).toBe(
      true,
    );
  });

  // a mod can belong to several collections, each recording its own tag, so the claim holds
  // through any of them - including after the collection that installed it first is removed
  it("claims a mod through any of the tags it carries", () => {
    const mods = { "col-b": collectionMod("col-b", ["tag-b"]) };
    const tags = collectionManagedTags(mods, profileWith("col-b"));
    const shared = makeMod({
      attributes: { referenceTag: "tag-a", referenceTags: ["tag-a", "tag-b"] },
    });

    expect(isCollectionManaged(shared, tags)).toBe(true);
  });

  it("does not claim a mod that carries no collection's tag", () => {
    const mods = { "col-a": collectionMod("col-a", ["tag-a"]) };
    const tags = collectionManagedTags(mods, profileWith("col-a"));

    expect(isCollectionManaged(makeMod({ attributes: { referenceTag: "own" } }), tags)).toBe(false);
    expect(isCollectionManaged(makeMod({ attributes: {} }), tags)).toBe(false);
  });

  it("claims a member the user opted into rather than one required", () => {
    const mods = { "col-o": collectionMod("col-o", ["tag-opt"], "recommends") };
    const tags = collectionManagedTags(mods, profileWith("col-o"));

    expect(isCollectionManaged(makeMod({ attributes: { referenceTag: "tag-opt" } }), tags)).toBe(
      true,
    );
  });
});

describe("collectionManagedTags", () => {
  it("reads only collections the profile has installed", () => {
    const mods = {
      "col-a": collectionMod("col-a", ["tag-a"]),
      "col-b": collectionMod("col-b", ["tag-b"]),
    };

    expect(Array.from(collectionManagedTags(mods, profileWith("col-a")))).toEqual(["tag-a"]);
  });

  it("reads no tags from a mod that is not a collection", () => {
    const mods = {
      "not-a-collection": makeMod({
        id: "not-a-collection",
        rules: [makeRule({ type: "requires", reference: makeReference({ tag: "tag-x" }) })],
      }),
    };

    expect(collectionManagedTags(mods, profileWith("not-a-collection")).size).toBe(0);
  });
});
