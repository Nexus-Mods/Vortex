/**
 * Pure tests for the revision-update decision helpers: which installed members a revision pulled in
 * as dependencies, and which of those the new revision no longer needs (offered for removal).
 */
import { describe, expect, it } from "vitest";

import { makeMod, makeReference, makeRevision, makeRule } from "../../../test-utils/builders";
import type { IRevisionMemberSpec } from "../../../test-utils/harnessTypes";
import type { IMod } from "../../mod_management/types/IMod";
import { findInstalledDependencyMembers, findObsoleteMembers } from "./collectionUpdate";

// the mods record (keyed by id) the update flow reads: the collection mod plus everything installed
function modsById(...mods: IMod[]): Record<string, IMod> {
  return Object.fromEntries(mods.map((mod) => [mod.id, mod]));
}

describe("findInstalledDependencyMembers", () => {
  it("returns the installed members a revision pulled in as dependencies", () => {
    const rev = makeRevision(1, [{ tag: "a" }, { tag: "b" }]);
    const mods = modsById(rev.collection, ...rev.installed);

    const members = findInstalledDependencyMembers(rev.rules, mods);

    expect(members.map((mod) => mod.id).sort()).toEqual(["inst-a", "inst-b"]);
  });

  it("excludes a member the user installed themselves (no installedAsDependency)", () => {
    const rev = makeRevision(1, [{ tag: "a" }, { tag: "b" }]);
    // a mod matching member b's tag but lacking the dependency marker (user-installed)
    const userInstalled = makeMod({ id: "inst-b", attributes: { referenceTag: "b" } });
    const mods = modsById(rev.collection, rev.installed[0], userInstalled);

    expect(findInstalledDependencyMembers(rev.rules, mods).map((mod) => mod.id)).toEqual([
      "inst-a",
    ]);
  });

  it("ignores a rule whose member is not installed", () => {
    const rev = makeRevision(1, [{ tag: "a" }, { tag: "b" }]);
    const mods = modsById(rev.collection, rev.installed[0]); // only member a present

    expect(findInstalledDependencyMembers(rev.rules, mods).map((mod) => mod.id)).toEqual([
      "inst-a",
    ]);
  });
});

describe("findObsoleteMembers", () => {
  // install `oldMembers`, then ask what swapping to `newMembers` makes obsolete. `extra` seeds
  // other installed mods (e.g. a user mod that still depends on a dropped member).
  function setup(
    oldMembers: IRevisionMemberSpec[],
    newMembers: IRevisionMemberSpec[],
    extra: IMod[] = [],
  ) {
    const oldRev = makeRevision(1, oldMembers);
    const newRev = makeRevision(2, newMembers);
    const mods = modsById(oldRev.collection, ...oldRev.installed, ...extra);
    const candidates = findInstalledDependencyMembers(oldRev.rules, mods);
    return { newRev, mods, candidates, oldModId: oldRev.collection.id };
  }

  it("flags a member the new revision dropped", () => {
    const { newRev, mods, candidates, oldModId } = setup(
      [{ tag: "a" }, { tag: "b" }],
      [{ tag: "a" }],
    );
    const obsolete = findObsoleteMembers(candidates, newRev.rules, mods, oldModId);
    expect(obsolete.map((mod) => mod.id)).toEqual(["inst-b"]);
  });

  it("keeps a member the new revision still requires", () => {
    const { newRev, mods, candidates, oldModId } = setup(
      [{ tag: "a" }, { tag: "b" }],
      [{ tag: "a" }, { tag: "b" }],
    );
    expect(findObsoleteMembers(candidates, newRev.rules, mods, oldModId)).toEqual([]);
  });

  it("flags the old file of an updated member whose tag changed", () => {
    const { newRev, mods, candidates, oldModId } = setup(
      [{ tag: "a" }, { tag: "x1" }],
      [{ tag: "a" }, { tag: "x2" }],
    );
    expect(
      findObsoleteMembers(candidates, newRev.rules, mods, oldModId).map((mod) => mod.id),
    ).toEqual(["inst-x1"]);
  });

  it("keeps a dropped member that another installed mod still depends on", () => {
    const other = makeMod({
      id: "other",
      rules: [makeRule({ type: "requires", reference: makeReference({ tag: "b" }) })],
    });
    const { newRev, mods, candidates, oldModId } = setup(
      [{ tag: "a" }, { tag: "b" }],
      [{ tag: "a" }],
      [other],
    );
    expect(findObsoleteMembers(candidates, newRev.rules, mods, oldModId)).toEqual([]);
  });
});
