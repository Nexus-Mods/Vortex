import { describe, expect, it } from "vitest";

import type { IMod } from "@/extensions/mod_management/types/IMod";
import {
  makeInstalledCollection,
  makeMod,
  makeProfile,
  makeProfileMod,
  makeReference,
  makeRule,
} from "@/test-utils/builders";

import { formatCollectionSource, makeCollectionIndex } from "./collectionMembershipSelectors";

const memberRules = (...tags: string[]) =>
  tags.map((tag) => makeRule({ reference: makeReference({ tag }) }));

// a profile that has each named collection installed, enabled or not
const profileWith = (collections: Record<string, boolean>) =>
  makeProfile({
    modState: Object.fromEntries(
      Object.entries(collections).map(([id, enabled]) => [id, makeProfileMod({ enabled })]),
    ),
  });

const gts: IMod = makeInstalledCollection({
  id: "gts",
  attributes: { collectionSlug: "qdurkx", revisionNumber: 117 },
  rules: memberRules("tag-a"),
});
const gtsSource = { collectionSlug: "qdurkx", revisionNumber: 117 };

describe("makeCollectionIndex", () => {
  it("names the collection whose rule pulled the mod in", () => {
    const member = makeMod({ id: "mod-a", attributes: { referenceTag: "tag-a" } });

    const index = makeCollectionIndex({ gts, "mod-a": member }, undefined);

    expect(index.sourceOf("mod-a")).toEqual(gtsSource);
  });

  it("prefers the collection the mod's own attributes record", () => {
    const member = makeMod({
      id: "mod-a",
      attributes: { referenceTag: "tag-a", collectionSlug: "other", revisionNumber: 4 },
    });

    const index = makeCollectionIndex({ gts, "mod-a": member }, undefined);

    expect(index.sourceOf("mod-a")).toEqual({ collectionSlug: "other", revisionNumber: 4 });
  });

  // only the first tag is the one older Vortex versions stamped, so every tag has to be tried
  it("names a collection reached through a later reference tag", () => {
    const member = makeMod({
      id: "mod-a",
      attributes: { referenceTag: "own-tag", referenceTags: ["own-tag", "tag-a"] },
    });

    const index = makeCollectionIndex({ gts, "mod-a": member }, undefined);

    expect(index.sourceOf("mod-a")).toEqual(gtsSource);
  });

  it("names no collection for a mod the user installed themselves", () => {
    const index = makeCollectionIndex({ gts, "mod-a": makeMod({ id: "mod-a" }) }, undefined);

    expect(index.sourceOf("mod-a")).toBeUndefined();
    expect(index.sourceOf(undefined)).toBeUndefined();
    expect(index.sourceOf("")).toBeUndefined();
  });

  // ordering rules point at members some other rule already pulled in
  it("ignores rules that do not pull a mod into the collection", () => {
    const ordering = makeInstalledCollection({
      id: "gts",
      rules: [makeRule({ type: "after", reference: makeReference({ tag: "tag-a" }) })],
    });
    const member = makeMod({ id: "mod-a", attributes: { referenceTag: "tag-a" } });

    const index = makeCollectionIndex({ gts: ordering, "mod-a": member }, undefined);

    expect(index.sourceOf("mod-a")).toBeUndefined();
  });

  it("lists the collections enabled on the profile", () => {
    const other = makeInstalledCollection({
      id: "other",
      attributes: { collectionSlug: "abcdef", revisionNumber: 3 },
    });

    const index = makeCollectionIndex({ gts, other }, profileWith({ gts: true, other: false }));

    expect(index.enabled).toEqual([gtsSource]);
  });
});

describe("formatCollectionSource", () => {
  it("reads as the collection's slug and revision", () => {
    expect(formatCollectionSource(gtsSource)).toBe("qdurkx@117");
  });
});
